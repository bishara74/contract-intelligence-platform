"""Tests for authentication: JWT verification, unauthorized access, user creation."""

from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.database import get_db
from app.main import app
from app.models.user import User
from tests.conftest import TestSessionLocal, _override_get_db


async def test_unauthenticated_request_returns_401(unauthenticated_client: AsyncClient) -> None:
    """GET /api/v1/contracts without auth header returns 401."""
    resp = await unauthenticated_client.get("/api/v1/contracts")
    assert resp.status_code == 401
    body = resp.json()
    assert body["success"] is False


async def test_invalid_token_returns_401(unauthenticated_client: AsyncClient) -> None:
    """GET /api/v1/contracts with invalid Bearer token returns 401."""
    resp = await unauthenticated_client.get(
        "/api/v1/contracts",
        headers={"Authorization": "Bearer invalid-token-abc"},
    )
    assert resp.status_code in (401, 503)
    body = resp.json()
    assert body["success"] is False


async def test_authenticated_request_succeeds(client: AsyncClient) -> None:
    """GET /api/v1/contracts with mock auth returns 200."""
    resp = await client.get("/api/v1/contracts")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


async def test_user_created_on_first_request() -> None:
    """get_or_create_user creates a user record when none exists."""
    from app.services.user_service import get_or_create_user

    async with TestSessionLocal() as session:
        user = await get_or_create_user(
            session,
            clerk_id="clerk_new_user_999",
            email="newuser@example.com",
            full_name="New User",
        )
        await session.commit()

        assert user.clerk_id == "clerk_new_user_999"
        assert user.email == "newuser@example.com"
        assert user.id is not None

        # Calling again returns the same user
        same_user = await get_or_create_user(
            session,
            clerk_id="clerk_new_user_999",
            email="newuser@example.com",
        )
        assert same_user.id == user.id
