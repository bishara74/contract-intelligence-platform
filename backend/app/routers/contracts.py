"""Contract management endpoints: upload, list, get, delete."""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.contract import Contract
from app.models.user import User
from app.schemas.contract import ContractResponse, UploadUrlRequest, UploadUrlResponse
from app.services import storage
from app.services.vector_store import delete_namespace

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /upload-url
# ---------------------------------------------------------------------------

@router.post("/upload-url")
async def get_upload_url(
    body: UploadUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a contract record and return a presigned R2 upload URL."""
    contract_id = uuid.uuid4()
    object_key = storage.object_key_for_contract(str(contract_id))

    try:
        upload_url = storage.generate_upload_url(object_key)
        file_url = storage.generate_download_url(object_key)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Storage service unavailable: {e}") from e

    contract = Contract(
        id=contract_id,
        user_id=current_user.id,
        filename=body.filename,
        file_url=file_url,
        file_size_bytes=body.file_size_bytes,
        status="uploading",
        pinecone_namespace=f"user_{current_user.id}_contract_{contract_id}",
    )
    db.add(contract)
    await db.flush()

    logger.info("Created contract %s for file '%s' (user %s)", contract_id, body.filename, current_user.id)

    return {
        "success": True,
        "data": UploadUrlResponse(
            contract_id=contract_id,
            upload_url=upload_url,
        ).model_dump(mode="json"),
    }


# ---------------------------------------------------------------------------
# POST /{contract_id}/confirm-upload
# ---------------------------------------------------------------------------

@router.post("/{contract_id}/confirm-upload")
async def confirm_upload(
    contract_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Mark a contract as uploaded and kick off the processing pipeline."""
    contract = await _get_user_contract_or_404(contract_id, current_user, db)

    if contract.status not in ("uploading", "error"):
        return {
            "success": True,
            "data": ContractResponse.model_validate(contract).model_dump(mode="json"),
        }

    contract.status = "processing"
    await db.commit()

    if settings.use_celery:
        from app.tasks.contract_tasks import process_contract_task
        process_contract_task.delay(str(contract_id))
    else:
        from app.tasks.contract_tasks import process_contract_sync
        background_tasks.add_task(process_contract_sync, str(contract_id))

    logger.info("Confirmed upload for contract %s — processing started", contract_id)

    return {
        "success": True,
        "data": ContractResponse.model_validate(contract).model_dump(mode="json"),
    }


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

@router.get("")
@router.get("/")
async def list_contracts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """List all contracts for the current user, ordered by creation date descending."""
    result = await db.execute(
        select(Contract)
        .where(Contract.user_id == current_user.id)
        .order_by(Contract.created_at.desc())
    )
    contracts = result.scalars().all()

    return {
        "success": True,
        "data": [ContractResponse.model_validate(c).model_dump(mode="json") for c in contracts],
    }


# ---------------------------------------------------------------------------
# GET /{contract_id}
# ---------------------------------------------------------------------------

@router.get("/{contract_id}")
async def get_contract(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Get a single contract by ID (must belong to current user)."""
    contract = await _get_user_contract_or_404(contract_id, current_user, db)
    return {
        "success": True,
        "data": ContractResponse.model_validate(contract).model_dump(mode="json"),
    }


# ---------------------------------------------------------------------------
# DELETE /{contract_id}
# ---------------------------------------------------------------------------

@router.delete("/{contract_id}")
async def delete_contract(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a contract and all its associated data (must belong to current user)."""
    contract = await _get_user_contract_or_404(contract_id, current_user, db)

    try:
        object_key = storage.object_key_for_contract(str(contract_id))
        storage.delete_object(object_key)
    except Exception as e:
        logger.warning("Could not delete R2 object for contract %s: %s", contract_id, e)

    try:
        delete_namespace(contract.pinecone_namespace)
    except Exception as e:
        logger.warning("Could not delete Pinecone namespace for contract %s: %s", contract_id, e)

    if settings.use_dynamodb:
        try:
            from app.services.dynamodb import delete_chat_messages
            deleted = delete_chat_messages(str(contract_id))
            logger.info("Deleted %d DynamoDB chat messages for contract %s", deleted, contract_id)
        except Exception as e:
            logger.warning("Could not delete DynamoDB messages for contract %s: %s", contract_id, e)

    await db.delete(contract)
    logger.info("Deleted contract %s", contract_id)

    return {"success": True, "data": {"deleted": True}}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _get_contract_or_404(contract_id: uuid.UUID, db: AsyncSession) -> Contract:
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


async def _get_user_contract_or_404(
    contract_id: uuid.UUID, current_user: User, db: AsyncSession
) -> Contract:
    contract = await _get_contract_or_404(contract_id, db)
    if contract.user_id is not None and contract.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return contract
