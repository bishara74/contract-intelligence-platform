"""Risk analysis endpoints: trigger analysis, retrieve risks with severity counts."""

import logging
import uuid
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.clause import Clause
from app.models.contract import Contract
from app.models.risk import Risk
from app.schemas.risk import RiskResponse
from app.services.risk_analyzer import SEVERITY_LEVELS
from app.tasks.contract_tasks import analyze_risks_task

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /{contract_id}/analyze-risks
# ---------------------------------------------------------------------------

@router.post("/{contract_id}/analyze-risks")
async def trigger_analyze_risks(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Trigger risk analysis as a Celery task.

    Requires clauses to be extracted first (GET /clauses must return > 0 results).
    """
    await _get_ready_contract(contract_id, db)

    # Verify clauses exist
    clause_result = await db.execute(
        select(Clause).where(Clause.contract_id == contract_id).limit(1)
    )
    if clause_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=409,
            detail="No clauses found. Run extract-clauses before analyze-risks.",
        )

    analyze_risks_task.delay(str(contract_id))

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

    # Order by severity: critical -> high -> medium -> low
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
