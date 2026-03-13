"""Create the DynamoDB table for chat message storage.

Run with: python -m scripts.create_dynamodb_table
"""

import sys
from typing import Any

import boto3

from app.config import settings


def create_table() -> None:
    """Create the DynamoDB chat messages table and wait until it exists."""
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
    table_name = settings.dynamodb_table_name

    print(f"Creating DynamoDB table '{table_name}'...")

    try:
        table = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {"AttributeName": "contract_id", "KeyType": "HASH"},
                {"AttributeName": "created_at", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "contract_id", "AttributeType": "S"},
                {"AttributeName": "created_at", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        table.wait_until_exists()
        print(f"Table '{table_name}' created successfully!")
    except dynamodb.meta.client.exceptions.ResourceInUseException:
        print(f"Table '{table_name}' already exists.")


if __name__ == "__main__":
    create_table()
