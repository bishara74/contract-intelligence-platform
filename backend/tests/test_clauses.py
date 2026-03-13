"""Tests for clause extraction endpoints."""

from unittest.mock import patch

from httpx import AsyncClient

from app.models.clause import Clause
from app.models.contract import Contract
from tests.conftest import TestSessionLocal


async def test_trigger_extraction_returns_200(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """POST /api/v1/contracts/{id}/extract-clauses returns success."""
    with patch("app.routers.clauses.settings") as mock_settings:
        mock_settings.use_celery = False
        with patch("app.tasks.contract_tasks.extract_clauses_sync"):
            resp = await client.post(
                f"/api/v1/contracts/{sample_contract.id}/extract-clauses"
            )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["status"] == "processing"


async def test_get_clauses_empty_before_extraction(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """GET /api/v1/contracts/{id}/clauses returns empty before extraction."""
    resp = await client.get(
        f"/api/v1/contracts/{sample_contract.id}/clauses"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["total"] == 0
    assert body["data"]["clauses_by_type"] == {}


async def test_get_clauses_after_extraction(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """After clauses are inserted, GET returns them grouped by type."""
    # Insert clauses directly into the test DB
    async with TestSessionLocal() as session:
        session.add(Clause(
            contract_id=sample_contract.id,
            clause_type="termination",
            title="Termination for Convenience",
            content="Either party may terminate with 30 days written notice.",
            page_number=3,
            confidence_score=0.95,
        ))
        session.add(Clause(
            contract_id=sample_contract.id,
            clause_type="termination",
            title="Termination for Cause",
            content="Immediate termination upon material breach.",
            page_number=4,
            confidence_score=0.91,
        ))
        session.add(Clause(
            contract_id=sample_contract.id,
            clause_type="liability",
            title="Limitation of Liability",
            content="Total liability shall not exceed the contract value.",
            page_number=6,
            confidence_score=0.88,
        ))
        await session.commit()

    resp = await client.get(
        f"/api/v1/contracts/{sample_contract.id}/clauses"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["total"] == 3
    assert "termination" in body["data"]["clauses_by_type"]
    assert "liability" in body["data"]["clauses_by_type"]
    assert len(body["data"]["clauses_by_type"]["termination"]) == 2
    assert len(body["data"]["clauses_by_type"]["liability"]) == 1
