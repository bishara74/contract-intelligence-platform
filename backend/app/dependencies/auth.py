"""Clerk JWT verification dependency for FastAPI."""

import logging
import time

import httpx
import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.user_service import get_or_create_user

logger = logging.getLogger(__name__)

_jwks_cache: dict = {"keys": None, "fetched_at": 0}
JWKS_CACHE_TTL = 3600  # 1 hour


async def _get_jwks_keys() -> list:
    """Fetch and cache Clerk's JWKS public keys."""
    now = time.time()
    if _jwks_cache["keys"] and (now - _jwks_cache["fetched_at"]) < JWKS_CACHE_TTL:
        return _jwks_cache["keys"]

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.clerk.com/v1/jwks",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
        )
        resp.raise_for_status()
        _jwks_cache["keys"] = resp.json()["keys"]
        _jwks_cache["fetched_at"] = now
        return _jwks_cache["keys"]


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    """Verify Clerk JWT and return User from database."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = auth_header.split(" ", 1)[1]

    try:
        jwks_keys = await _get_jwks_keys()
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        signing_key = None
        for key in jwks_keys:
            if key.get("kid") == kid:
                signing_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                break

        if not signing_key:
            raise HTTPException(status_code=401, detail="Invalid token signing key")

        payload = jwt.decode(token, signing_key, algorithms=["RS256"])
        clerk_id = payload.get("sub")
        email = payload.get("email", "")

        if not clerk_id:
            raise HTTPException(status_code=401, detail="Invalid token claims")

    except jwt.exceptions.PyJWTError as e:
        logger.warning("JWT verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    user = await get_or_create_user(db, clerk_id=clerk_id, email=email)
    return user
