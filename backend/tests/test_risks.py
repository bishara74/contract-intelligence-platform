"""Tests for risk analysis endpoints."""

from unittest.mock import patch

from httpx import AsyncClient

from app.models.clause import Clause
from app.models.contract import Contract
from app.models.risk import Risk
from tests.conftest import TestSessionLocal


async def _insert_clause(contract_id) -> Clause:
    """Helper to insert a clause so risk analysis can proceed."""
    clause = Clause(
        contract_id=contract_id,
        clause_type="termination",
        title="Termination Clause",
        content="Either party may terminate with 30 days notice.",
        page_number=3,
        confidence_score=0.95,
    )
    async with TestSessionLocal() as session:
        session.add(clause)
        await session.commit()
        await session.refresh(clause)
    return clause


async def test_trigger_analysis_returns_200(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """POST /api/v1/contracts/{id}/analyze-risks returns success."""
    await _insert_clause(sample_contract.id)

    with patch("app.routers.risks.settings") as mock_settings:
        mock_settings.use_celery = False
        with patch("app.tasks.contract_tasks.analyze_risks_sync"):
            resp = await client.post(
                f"/api/v1/contracts/{sample_contract.id}/analyze-risks"
            )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["status"] == "processing"


async def test_get_risks_empty_before_analysis(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """GET /api/v1/contracts/{id}/risks returns empty before analysis."""
    resp = await client.get(
        f"/api/v1/contracts/{sample_contract.id}/risks"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["total"] == 0
    assert body["data"]["risks"] == []


async def test_get_risks_after_analysis(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """After risks are inserted, GET returns them with severity levels."""
    clause = await _insert_clause(sample_contract.id)

    async with TestSessionLocal() as session:
        session.add(Risk(
            contract_id=sample_contract.id,
            clause_id=clause.id,
            risk_type="auto_renewal",
            severity="high",
            title="Auto-Renewal Trap",
            description="Contract auto-renews without adequate notice period.",
            recommendation="Add a 60-day notice requirement before auto-renewal.",
        ))
        session.add(Risk(
            contract_id=sample_contract.id,
            clause_id=None,
            risk_type="uncapped_liability",
            severity="critical",
            title="Uncapped Liability",
            description="No limitation on total liability exposure.",
            recommendation="Add a liability cap equal to contract value.",
        ))
        session.add(Risk(
            contract_id=sample_contract.id,
            clause_id=None,
            risk_type="missing_clause",
            severity="medium",
            title="Missing Force Majeure",
            description="No force majeure clause found.",
            recommendation="Add a force majeure clause to protect against unforeseen events.",
        ))
        await session.commit()

    resp = await client.get(
        f"/api/v1/contracts/{sample_contract.id}/risks"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["total"] == 3

    # Risks should be sorted: critical first
    risks = body["data"]["risks"]
    assert risks[0]["severity"] == "critical"
    assert risks[1]["severity"] == "high"
    assert risks[2]["severity"] == "medium"

    # Severity counts
    counts = body["data"]["severity_counts"]
    assert counts["critical"] == 1
    assert counts["high"] == 1
    assert counts["medium"] == 1
    assert counts["low"] == 0
