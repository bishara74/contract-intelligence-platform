"""Tests for RAG chat endpoint and chat history."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.models.contract import Contract

# Force PostgreSQL path for all chat tests (avoid DynamoDB dependency)
pytestmark = pytest.mark.usefixtures("_disable_dynamodb")


@pytest.fixture(autouse=True)
def _disable_dynamodb():
    """Ensure use_dynamodb is False so tests use the PostgreSQL chat path."""
    with patch("app.routers.chat.settings") as mock_settings:
        mock_settings.use_dynamodb = False
        yield


async def test_chat_returns_answer(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """POST /api/v1/contracts/{id}/chat with mocked RAG returns an answer."""
    mock_result = {
        "answer": "The termination clause requires 30 days notice.",
        "sources": [{"page": 2, "text": "termination with 30 days notice", "score": 0.92}],
    }
    with patch("app.routers.chat.ask", new_callable=AsyncMock, return_value=mock_result):
        resp = await client.post(
            f"/api/v1/contracts/{sample_contract.id}/chat",
            json={"question": "What is the termination clause?"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "termination" in body["data"]["answer"].lower()
    assert "message_id" in body["data"]


async def test_chat_includes_sources(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """Chat response includes source_chunks with page numbers."""
    mock_result = {
        "answer": "Liability is capped at $1M.",
        "sources": [
            {"page": 3, "text": "liability cap of $1,000,000", "score": 0.88},
            {"page": 5, "text": "aggregate liability shall not exceed", "score": 0.81},
        ],
    }
    with patch("app.routers.chat.ask", new_callable=AsyncMock, return_value=mock_result):
        resp = await client.post(
            f"/api/v1/contracts/{sample_contract.id}/chat",
            json={"question": "What is the liability cap?"},
        )

    body = resp.json()
    sources = body["data"]["sources"]
    assert len(sources) == 2
    assert sources[0]["page"] == 3
    assert sources[1]["page"] == 5


async def test_chat_with_nonexistent_contract_returns_404(
    client: AsyncClient,
) -> None:
    """Invalid contract ID returns 404."""
    fake_id = uuid.uuid4()
    resp = await client.post(
        f"/api/v1/contracts/{fake_id}/chat",
        json={"question": "What does this say?"},
    )
    assert resp.status_code == 404


async def test_chat_history_empty(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """GET /api/v1/contracts/{id}/chat/history returns empty for new contract."""
    resp = await client.get(f"/api/v1/contracts/{sample_contract.id}/chat/history")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["messages"] == []


async def test_chat_history_after_message(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """After sending a message, history includes both user and assistant messages."""
    mock_result = {
        "answer": "The contract is governed by New York law.",
        "sources": [{"page": 8, "text": "governed by the laws of New York", "score": 0.95}],
    }
    with patch("app.routers.chat.ask", new_callable=AsyncMock, return_value=mock_result):
        await client.post(
            f"/api/v1/contracts/{sample_contract.id}/chat",
            json={"question": "What is the governing law?"},
        )

    resp = await client.get(f"/api/v1/contracts/{sample_contract.id}/chat/history")
    body = resp.json()
    messages = body["data"]["messages"]
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "What is the governing law?"
    assert messages[1]["role"] == "assistant"
    assert "New York" in messages[1]["content"]
