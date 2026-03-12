"""Clause extraction endpoints: trigger extraction, retrieve grouped clauses."""

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
from app.schemas.clause import ClauseResponse
from app.tasks.contract_tasks import extract_clauses_task

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /{contract_id}/extract-clauses
# ---------------------------------------------------------------------------

@router.post("/{contract_id}/extract-clauses")
async def trigger_extract_clauses(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Trigger clause extraction as a Celery task."""
    await _get_ready_contract(contract_id, db)

    extract_clauses_task.delay(str(contract_id))

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
