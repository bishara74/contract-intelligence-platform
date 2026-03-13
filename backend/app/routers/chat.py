"""Chat (RAG) endpoints: send a message, retrieve history."""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.chat_message import ChatMessage
from app.models.contract import Contract
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatMessageResponse, ChatResponse, SourceChunk
from app.services.rag import ask

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /{contract_id}/chat
# ---------------------------------------------------------------------------

@router.post("/{contract_id}/chat")
async def chat(
    contract_id: uuid.UUID,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Answer a question about a contract using RAG.

    Persists both the user message and the assistant response to chat_messages.
    """
    contract = await _get_ready_contract(contract_id, current_user, db)

    if settings.use_dynamodb:
        from app.services.dynamodb import save_chat_message, get_chat_history as dynamo_get_history

        # Save user message to DynamoDB
        save_chat_message(
            contract_id=str(contract_id),
            user_id=str(current_user.id),
            role="user",
            content=body.question,
        )

        # Get chat history from DynamoDB for context (last 20)
        dynamo_messages = dynamo_get_history(str(contract_id), limit=20)
        chat_history = [{"role": m["role"], "content": m["content"]} for m in dynamo_messages]

        # Run RAG pipeline
        try:
            result = await ask(
                question=body.question,
                namespace=contract.pinecone_namespace,
                chat_history=chat_history,
            )
        except Exception as e:
            logger.exception("RAG pipeline failed for contract %s: %s", contract_id, e)
            raise HTTPException(status_code=502, detail=f"RAG pipeline error: {e}") from e

        answer = result["answer"]
        sources = result["sources"]

        # Save assistant response to DynamoDB
        assistant_item = save_chat_message(
            contract_id=str(contract_id),
            user_id=str(current_user.id),
            role="assistant",
            content=answer,
            source_chunks=sources or None,
        )

        logger.info(
            "Chat answered for contract %s: %d source chunks (DynamoDB)",
            contract_id, len(sources),
        )

        return {
            "success": True,
            "data": ChatResponse(
                answer=answer,
                sources=[SourceChunk(**s) for s in sources],
                message_id=uuid.UUID(assistant_item["message_id"]),
            ).model_dump(mode="json"),
        }
    else:
        # PostgreSQL path (existing code)
        # Load last 20 messages for context (we pass the last 10 to the chain inside rag.py)
        history_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.contract_id == contract_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(20)
        )
        history_messages = history_result.scalars().all()
        chat_history = [{"role": m.role, "content": m.content} for m in history_messages]

        # Persist the user message first
        user_msg = ChatMessage(
            contract_id=contract_id,
            role="user",
            content=body.question,
            source_chunks=None,
        )
        db.add(user_msg)
        await db.flush()

        # Run RAG pipeline
        try:
            result = await ask(
                question=body.question,
                namespace=contract.pinecone_namespace,
                chat_history=chat_history,
            )
        except Exception as e:
            logger.exception("RAG pipeline failed for contract %s: %s", contract_id, e)
            raise HTTPException(status_code=502, detail=f"RAG pipeline error: {e}") from e

        answer = result["answer"]
        sources = result["sources"]

        # Persist the assistant response
        assistant_msg = ChatMessage(
            contract_id=contract_id,
            role="assistant",
            content=answer,
            source_chunks=sources or None,
        )
        db.add(assistant_msg)
        await db.flush()

        logger.info(
            "Chat answered for contract %s: %d source chunks",
            contract_id, len(sources),
        )

        return {
            "success": True,
            "data": ChatResponse(
                answer=answer,
                sources=[SourceChunk(**s) for s in sources],
                message_id=assistant_msg.id,
            ).model_dump(mode="json"),
        }


# ---------------------------------------------------------------------------
# GET /{contract_id}/chat/history
# ---------------------------------------------------------------------------

@router.get("/{contract_id}/chat/history")
async def get_chat_history(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return all chat messages for a contract in chronological order."""
    await _get_ready_contract(contract_id, current_user, db)

    if settings.use_dynamodb:
        from app.services.dynamodb import get_chat_history as dynamo_get_history

        messages = dynamo_get_history(str(contract_id))
        return {
            "success": True,
            "data": {
                "messages": [
                    {
                        "id": m["message_id"],
                        "contract_id": m["contract_id"],
                        "role": m["role"],
                        "content": m["content"],
                        "source_chunks": m.get("source_chunks") or None,
                        "created_at": m["created_at"],
                    }
                    for m in messages
                ]
            },
        }
    else:
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.contract_id == contract_id)
            .order_by(ChatMessage.created_at.asc())
        )
        messages = result.scalars().all()

        return {
            "success": True,
            "data": {
                "messages": [
                    ChatMessageResponse.model_validate(m).model_dump(mode="json")
                    for m in messages
                ]
            },
        }


# ---------------------------------------------------------------------------
# Shared helper
# ---------------------------------------------------------------------------

async def _get_ready_contract(
    contract_id: uuid.UUID, current_user: User, db: AsyncSession
) -> Contract:
    """Fetch a contract, verify ownership, and check it's in 'ready' state."""
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.user_id is not None and contract.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if contract.status != "ready":
        raise HTTPException(
            status_code=409,
            detail=f"Contract is not ready for chat (status: {contract.status})",
        )
    return contract
