"""User service: create and retrieve users by Clerk ID."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_or_create_user(
    db: AsyncSession,
    clerk_id: str,
    email: str,
    full_name: str | None = None,
    avatar_url: str | None = None,
) -> User:
    """Find user by clerk_id or create new one."""
    user = await get_user_by_clerk_id(db, clerk_id)
    if user:
        return user

    user = User(
        clerk_id=clerk_id,
        email=email,
        full_name=full_name,
        avatar_url=avatar_url,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def get_user_by_clerk_id(db: AsyncSession, clerk_id: str) -> User | None:
    """Find user by clerk_id, return None if not found."""
    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    return result.scalar_one_or_none()
