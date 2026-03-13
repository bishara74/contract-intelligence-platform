"""Tests for the health endpoint."""

from httpx import AsyncClient


async def test_health_returns_ok(client: AsyncClient) -> None:
    """GET /api/v1/health returns 200 with success: true."""
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


async def test_health_shows_db_connected(client: AsyncClient) -> None:
    """Health response includes database status 'connected'."""
    resp = await client.get("/api/v1/health")
    body = resp.json()
    assert body["data"]["database"] == "connected"
    assert body["data"]["status"] == "ok"
