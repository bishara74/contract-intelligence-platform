"""DynamoDB service for chat message storage.

Provides an alternative to PostgreSQL for storing chat messages.
Controlled by the USE_DYNAMODB setting — when False, PostgreSQL is used instead.
"""

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

from app.config import settings

logger = logging.getLogger(__name__)


def _get_dynamodb_table():
    """Return a boto3 DynamoDB Table resource using application settings."""
    kwargs: dict[str, Any] = {
        "region_name": settings.aws_region,
    }
    if settings.dynamodb_endpoint_url:
        kwargs["endpoint_url"] = settings.dynamodb_endpoint_url
    if settings.aws_access_key_id_dynamo:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id_dynamo
    if settings.aws_secret_access_key_dynamo:
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key_dynamo

    dynamodb = boto3.resource("dynamodb", **kwargs)
    return dynamodb.Table(settings.dynamodb_table_name)


def _convert_decimals(obj: Any) -> Any:
    """Recursively convert Decimal values from DynamoDB to int/float."""
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    if isinstance(obj, dict):
        return {k: _convert_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_decimals(i) for i in obj]
    return obj


def _convert_floats_to_decimal(obj: Any) -> Any:
    """Recursively convert float values to Decimal for DynamoDB storage."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _convert_floats_to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_floats_to_decimal(v) for v in obj]
    return obj


def save_chat_message(
    contract_id: str,
    user_id: str,
    role: str,
    content: str,
    source_chunks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Save a chat message to DynamoDB.

    Returns the saved item dict including generated message_id and created_at.
    """
    table = _get_dynamodb_table()
    now = datetime.now(timezone.utc).isoformat()
    message_id = str(uuid.uuid4())

    item: dict[str, Any] = {
        "contract_id": contract_id,
        "created_at": now,
        "message_id": message_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "source_chunks": source_chunks or [],
    }

    item = _convert_floats_to_decimal(item)
    table.put_item(Item=item)
    logger.info("Saved %s message %s to DynamoDB for contract %s", role, message_id, contract_id)
    return item


def get_chat_history(contract_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Query chat messages for a contract ordered by created_at ascending.

    Returns a list of message dicts with Decimal values converted to Python numbers.
    """
    table = _get_dynamodb_table()

    response = table.query(
        KeyConditionExpression=Key("contract_id").eq(contract_id),
        ScanIndexForward=True,
        Limit=limit,
    )

    messages = [_convert_decimals(item) for item in response.get("Items", [])]
    logger.info("Retrieved %d messages from DynamoDB for contract %s", len(messages), contract_id)
    return messages


def delete_chat_messages(contract_id: str) -> int:
    """Batch-delete all chat messages for a contract.

    Queries all items first, then deletes them using batch_writer().
    Returns the number of deleted items.
    """
    table = _get_dynamodb_table()

    # Query all items for this contract
    response = table.query(
        KeyConditionExpression=Key("contract_id").eq(contract_id),
        ProjectionExpression="contract_id, created_at",
    )
    items = response.get("Items", [])

    # Handle pagination
    while response.get("LastEvaluatedKey"):
        response = table.query(
            KeyConditionExpression=Key("contract_id").eq(contract_id),
            ProjectionExpression="contract_id, created_at",
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))

    if not items:
        return 0

    # Batch delete
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(
                Key={
                    "contract_id": item["contract_id"],
                    "created_at": item["created_at"],
                }
            )

    logger.info("Deleted %d messages from DynamoDB for contract %s", len(items), contract_id)
    return len(items)
