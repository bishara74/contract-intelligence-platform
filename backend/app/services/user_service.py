"""User service: create and retrieve users by Clerk ID."""

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)


async def get_or_create_user(
    db: AsyncSession,
    clerk_id: str,
    email: str | None = None,
    full_name: str | None = None,
    avatar_url: str | None = None,
) -> User:
    """Find user by clerk_id or create new one.

    If email is empty or None, a placeholder is generated from clerk_id
    to satisfy the non-null unique constraint on the email column.
    """
    user = await get_user_by_clerk_id(db, clerk_id)
    if user:
        return user

    # Ensure email is never empty string — use placeholder if missing
    if not email:
        email = f"{clerk_id}@placeholder.local"

    user = User(
        clerk_id=clerk_id,
        email=email,
        full_name=full_name,
        avatar_url=avatar_url,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        logger.warning("IntegrityError creating user %s, retrying lookup", clerk_id)
        user = await get_user_by_clerk_id(db, clerk_id)
        if user:
            return user
        raise
    await db.refresh(user)
    return user


async def get_user_by_clerk_id(db: AsyncSession, clerk_id: str) -> User | None:
    """Find user by clerk_id, return None if not found."""
    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    return result.scalar_one_or_none()
