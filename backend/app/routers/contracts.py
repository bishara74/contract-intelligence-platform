"""Contract management endpoints: upload, list, get, delete."""

import logging
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models.contract import Contract
from app.schemas.contract import ContractResponse, UploadUrlRequest, UploadUrlResponse
from app.services import storage
from app.services.pdf_parser import parse_pdf
from app.services.vector_store import delete_namespace, upsert_chunks

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /upload-url
# ---------------------------------------------------------------------------

@router.post("/upload-url")
async def get_upload_url(
    body: UploadUrlRequest,
    db: AsyncSession = Depends(get_db),
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
        filename=body.filename,
        file_url=file_url,
        file_size_bytes=body.file_size_bytes,
        status="uploading",
        pinecone_namespace=f"contract_{contract_id}",
    )
    db.add(contract)
    await db.flush()

    logger.info("Created contract %s for file '%s'", contract_id, body.filename)

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
) -> dict[str, Any]:
    """Mark a contract as uploaded and kick off the processing pipeline."""
    contract = await _get_contract_or_404(contract_id, db)

    if contract.status not in ("uploading", "error"):
        return {
            "success": True,
            "data": ContractResponse.model_validate(contract).model_dump(mode="json"),
        }

    contract.status = "processing"
    await db.flush()

    background_tasks.add_task(_process_contract, str(contract_id))

    logger.info("Confirmed upload for contract %s — processing started", contract_id)

    return {
        "success": True,
        "data": ContractResponse.model_validate(contract).model_dump(mode="json"),
    }


async def _process_contract(contract_id: str) -> None:
    """Background processing pipeline (grows with each step).

    Step 4: download PDF from R2, parse + chunk with PyMuPDF/LangChain, update page/chunk counts.
    Steps 5-8: embed → RAG → clauses → risks.
    """
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Contract).where(Contract.id == uuid.UUID(contract_id)))
            contract = result.scalar_one_or_none()
            if not contract:
                logger.error("Contract %s not found during processing", contract_id)
                return

            # ── Step 4: Download PDF bytes from R2 ───────────────────────────
            object_key = storage.object_key_for_contract(contract_id)
            download_url = storage.generate_download_url(object_key, expires_in=300)

            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.get(download_url)
                response.raise_for_status()
                pdf_bytes = response.content

            # ── Step 4: Parse + chunk ─────────────────────────────────────────
            pages, chunks = parse_pdf(pdf_bytes)

            contract.page_count = len(pages)
            contract.chunk_count = len(chunks)
            await db.flush()

            # ── Step 5: Embed + upsert into Pinecone ─────────────────────────
            await upsert_chunks(
                chunks=chunks,
                contract_id=str(contract_id),
                filename=contract.filename,
                namespace=contract.pinecone_namespace,
            )

            # Steps 6–8 will add RAG, clause extraction, risk analysis
            contract.status = "ready"
            await db.commit()

            logger.info(
                "Contract %s processed: %d pages, %d chunks",
                contract_id, len(pages), len(chunks),
            )

        except Exception as exc:
            logger.exception("Processing failed for contract %s: %s", contract_id, exc)
            try:
                result = await db.execute(
                    select(Contract).where(Contract.id == uuid.UUID(contract_id))
                )
                contract = result.scalar_one_or_none()
                if contract:
                    contract.status = "error"
                    contract.error_message = str(exc)
                    await db.commit()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

@router.get("")
@router.get("/")
async def list_contracts(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """List all contracts ordered by creation date descending."""
    result = await db.execute(
        select(Contract).order_by(Contract.created_at.desc())
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
) -> dict[str, Any]:
    """Get a single contract by ID."""
    contract = await _get_contract_or_404(contract_id, db)
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
) -> dict[str, Any]:
    """Delete a contract and all its associated data."""
    contract = await _get_contract_or_404(contract_id, db)

    try:
        object_key = storage.object_key_for_contract(str(contract_id))
        storage.delete_object(object_key)
    except Exception as e:
        logger.warning("Could not delete R2 object for contract %s: %s", contract_id, e)

    try:
        await _delete_pinecone_namespace(contract.pinecone_namespace)
    except Exception as e:
        logger.warning("Could not delete Pinecone namespace for contract %s: %s", contract_id, e)

    await db.delete(contract)
    logger.info("Deleted contract %s", contract_id)

    return {"success": True, "data": {"deleted": True}}


async def _delete_pinecone_namespace(namespace: str) -> None:
    """Delete all vectors for a contract from Pinecone."""
    delete_namespace(namespace)


# ---------------------------------------------------------------------------
# Shared helper
# ---------------------------------------------------------------------------

async def _get_contract_or_404(contract_id: uuid.UUID, db: AsyncSession) -> Contract:
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract
