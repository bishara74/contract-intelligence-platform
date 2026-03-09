"""Clause extraction endpoints: trigger extraction, retrieve grouped clauses."""

import logging
import uuid
from collections import defaultdict
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models.clause import Clause
from app.models.contract import Contract
from app.schemas.clause import ClauseResponse
from app.services import storage
from app.services.clause_extractor import extract_clauses
from app.services.pdf_parser import parse_pdf

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /{contract_id}/extract-clauses
# ---------------------------------------------------------------------------

@router.post("/{contract_id}/extract-clauses")
async def trigger_extract_clauses(
    contract_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Trigger clause extraction as a background task."""
    contract = await _get_ready_contract(contract_id, db)

    background_tasks.add_task(_run_extraction, str(contract_id))

    logger.info("Clause extraction triggered for contract %s", contract_id)
    return {"success": True, "data": {"status": "processing", "contract_id": str(contract_id)}}


# ---------------------------------------------------------------------------
# GET /{contract_id}/clauses
# ---------------------------------------------------------------------------

@router.get("/{contract_id}/clauses")
async def get_clauses(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Return extracted clauses grouped by type."""
    await _get_ready_contract(contract_id, db)

    result = await db.execute(
        select(Clause)
        .where(Clause.contract_id == contract_id)
        .order_by(Clause.clause_type, Clause.page_number)
    )
    clauses = result.scalars().all()

    grouped: dict[str, list] = defaultdict(list)
    for clause in clauses:
        grouped[clause.clause_type].append(
            ClauseResponse.model_validate(clause).model_dump(mode="json")
        )

    return {
        "success": True,
        "data": {
            "clauses_by_type": dict(grouped),
            "total": len(clauses),
        },
    }


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------

async def _run_extraction(contract_id: str) -> None:
    """Download PDF, parse chunks, extract clauses, save to DB, update summary."""
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Contract).where(Contract.id == uuid.UUID(contract_id))
            )
            contract = result.scalar_one_or_none()
            if not contract:
                logger.error("Contract %s not found for clause extraction", contract_id)
                return

            # Download PDF from R2
            object_key = storage.object_key_for_contract(contract_id)
            download_url = storage.generate_download_url(object_key, expires_in=300)

            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.get(download_url)
                response.raise_for_status()
                pdf_bytes = response.content

            # Parse to get chunks
            _, chunks = parse_pdf(pdf_bytes)

            # Extract clauses + summary
            extracted, summary = await extract_clauses(chunks, contract_id)

            # Delete existing clauses (re-extraction)
            existing = await db.execute(
                select(Clause).where(Clause.contract_id == uuid.UUID(contract_id))
            )
            for old_clause in existing.scalars().all():
                await db.delete(old_clause)
            await db.flush()

            # Persist new clauses
            for ec in extracted:
                clause = Clause(
                    contract_id=uuid.UUID(contract_id),
                    clause_type=ec.clause_type if ec.clause_type in _VALID_TYPES else "other",
                    title=ec.title,
                    content=ec.content,
                    page_number=ec.page_number,
                    confidence_score=min(max(ec.confidence_score, 0.0), 1.0),
                )
                db.add(clause)

            # Update contract summary
            if summary:
                contract.summary = summary

            await db.commit()
            logger.info(
                "Clause extraction complete for contract %s: %d clauses saved",
                contract_id, len(extracted),
            )

        except Exception as e:
            logger.exception("Clause extraction failed for contract %s: %s", contract_id, e)


_VALID_TYPES = {
    "termination", "liability", "indemnification", "confidentiality",
    "payment_terms", "governing_law", "non_compete", "intellectual_property",
    "force_majeure", "dispute_resolution", "warranty", "insurance",
    "data_protection", "other",
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
