"""Risk analysis endpoints: trigger analysis, retrieve risks with severity counts."""

import logging
import uuid
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models.clause import Clause
from app.models.contract import Contract
from app.models.risk import Risk
from app.schemas.risk import RiskResponse
from app.services.risk_analyzer import SEVERITY_LEVELS, analyze_risks, build_clauses_text

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /{contract_id}/analyze-risks
# ---------------------------------------------------------------------------

@router.post("/{contract_id}/analyze-risks")
async def trigger_analyze_risks(
    contract_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Trigger risk analysis as a background task.

    Requires clauses to be extracted first (GET /clauses must return > 0 results).
    """
    contract = await _get_ready_contract(contract_id, db)

    # Verify clauses exist
    clause_result = await db.execute(
        select(Clause).where(Clause.contract_id == contract_id).limit(1)
    )
    if clause_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=409,
            detail="No clauses found. Run extract-clauses before analyze-risks.",
        )

    background_tasks.add_task(_run_analysis, str(contract_id))

    logger.info("Risk analysis triggered for contract %s", contract_id)
    return {"success": True, "data": {"status": "processing", "contract_id": str(contract_id)}}


# ---------------------------------------------------------------------------
# GET /{contract_id}/risks
# ---------------------------------------------------------------------------

@router.get("/{contract_id}/risks")
async def get_risks(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Return all risks sorted by severity (critical first) with counts per severity."""
    await _get_ready_contract(contract_id, db)

    # Order by severity: critical → high → medium → low
    result = await db.execute(
        select(Risk)
        .where(Risk.contract_id == contract_id)
        .order_by(Risk.created_at.asc())
    )
    risks = result.scalars().all()

    # Sort by severity priority
    severity_order = {s: i for i, s in enumerate(["critical", "high", "medium", "low"])}
    sorted_risks = sorted(risks, key=lambda r: severity_order.get(r.severity, 99))

    # Count by severity
    severity_counts: dict[str, int] = defaultdict(int)
    for risk in risks:
        severity_counts[risk.severity] += 1

    return {
        "success": True,
        "data": {
            "risks": [
                RiskResponse.model_validate(r).model_dump(mode="json") for r in sorted_risks
            ],
            "severity_counts": {s: severity_counts.get(s, 0) for s in SEVERITY_LEVELS},
            "total": len(risks),
        },
    }


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------

async def _run_analysis(contract_id: str) -> None:
    """Load clauses, run LLM risk analysis, save results to DB."""
    async with AsyncSessionLocal() as db:
        try:
            # Load all clauses ordered by confidence (highest first for type→id map)
            clause_result = await db.execute(
                select(Clause)
                .where(Clause.contract_id == uuid.UUID(contract_id))
                .order_by(Clause.confidence_score.desc())
            )
            clauses = clause_result.scalars().all()

            if not clauses:
                logger.warning("No clauses for contract %s — skipping risk analysis", contract_id)
                return

            clauses_text, type_to_clause_id = build_clauses_text(clauses)

            # Run LLM analysis
            identified_risks = await analyze_risks(
                clauses_text=clauses_text,
                clause_type_map=type_to_clause_id,
                contract_id=contract_id,
            )

            # Delete previous risk analysis
            existing = await db.execute(
                select(Risk).where(Risk.contract_id == uuid.UUID(contract_id))
            )
            for old_risk in existing.scalars().all():
                await db.delete(old_risk)
            await db.flush()

            # Persist new risks, linking to clause where possible
            for ir in identified_risks:
                clause_id: uuid.UUID | None = None
                if ir.related_clause_type and ir.related_clause_type in type_to_clause_id:
                    try:
                        clause_id = uuid.UUID(type_to_clause_id[ir.related_clause_type])
                    except ValueError:
                        pass

                severity = ir.severity if ir.severity in SEVERITY_LEVELS else "medium"

                risk = Risk(
                    contract_id=uuid.UUID(contract_id),
                    clause_id=clause_id,
                    risk_type=ir.risk_type,
                    severity=severity,
                    title=ir.title,
                    description=ir.description,
                    recommendation=ir.recommendation,
                )
                db.add(risk)

            await db.commit()
            logger.info(
                "Risk analysis complete for contract %s: %d risks saved",
                contract_id, len(identified_risks),
            )

        except Exception as e:
            logger.exception("Risk analysis failed for contract %s: %s", contract_id, e)


# ---------------------------------------------------------------------------
# Shared helper
# ---------------------------------------------------------------------------

async def _get_ready_contract(contract_id: uuid.UUID, db: AsyncSession) -> Contract:
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.status != "ready":
        raise HTTPException(
            status_code=409,
            detail=f"Contract is not ready (status: {contract.status})",
        )
    return contract
