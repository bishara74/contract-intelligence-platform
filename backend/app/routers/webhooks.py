"""Clerk webhook endpoints: handle user lifecycle events."""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from svix.webhooks import Webhook, WebhookVerificationError

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/clerk")
@router.post("/clerk/")
async def clerk_webhook(request: Request) -> dict[str, Any]:
    """Handle Clerk webhook events (user.created, user.updated, user.deleted)."""
    body = await request.body()

    # Verify webhook signature
    try:
        wh = Webhook(settings.clerk_webhook_secret)
        payload = wh.verify(
            body,
            {
                "svix-id": request.headers.get("svix-id", ""),
                "svix-timestamp": request.headers.get("svix-timestamp", ""),
                "svix-signature": request.headers.get("svix-signature", ""),
            },
        )
    except WebhookVerificationError:
        logger.warning("Clerk webhook signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = payload.get("type", "")
    data = payload.get("data", {})

    async with AsyncSessionLocal() as db:
        try:
            if event_type == "user.created":
                await _handle_user_created(db, data)
            elif event_type == "user.updated":
                await _handle_user_updated(db, data)
            elif event_type == "user.deleted":
                await _handle_user_deleted(db, data)
            else:
                logger.info("Ignoring Clerk webhook event: %s", event_type)

            await db.commit()
        except Exception:
            await db.rollback()
            raise

    return {"success": True}


async def _handle_user_created(db: Any, data: dict) -> None:
    """Create a new user from Clerk webhook data."""
    clerk_id = data.get("id", "")
    email = _extract_primary_email(data)
    full_name = f"{data.get('first_name', '') or ''} {data.get('last_name', '') or ''}".strip() or None
    avatar_url = data.get("image_url")

    existing = await db.execute(select(User).where(User.clerk_id == clerk_id))
    if existing.scalar_one_or_none():
        logger.info("User %s already exists, skipping create", clerk_id)
        return

    user = User(
        clerk_id=clerk_id,
        email=email,
        full_name=full_name,
        avatar_url=avatar_url,
    )
    db.add(user)
    await db.flush()
    logger.info("Created user %s (%s) from webhook", clerk_id, email)


async def _handle_user_updated(db: Any, data: dict) -> None:
    """Update an existing user from Clerk webhook data."""
    clerk_id = data.get("id", "")
    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()

    if not user:
        logger.warning("User %s not found for update, creating instead", clerk_id)
        await _handle_user_created(db, data)
        return

    user.email = _extract_primary_email(data)
    user.full_name = f"{data.get('first_name', '') or ''} {data.get('last_name', '') or ''}".strip() or None
    user.avatar_url = data.get("image_url")
    logger.info("Updated user %s from webhook", clerk_id)


async def _handle_user_deleted(db: Any, data: dict) -> None:
    """Delete a user from Clerk webhook data."""
    clerk_id = data.get("id", "")
    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()

    if not user:
        logger.warning("User %s not found for deletion", clerk_id)
        return

    await db.delete(user)
    logger.info("Deleted user %s from webhook", clerk_id)


def _extract_primary_email(data: dict) -> str:
    """Extract the primary email from Clerk webhook data."""
    email_addresses = data.get("email_addresses", [])
    primary_email_id = data.get("primary_email_address_id")

    for addr in email_addresses:
        if addr.get("id") == primary_email_id:
            return addr.get("email_address", "")

    # Fallback: use first email
    if email_addresses:
        return email_addresses[0].get("email_address", "")

    return ""
