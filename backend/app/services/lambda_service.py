"""AWS Lambda invocation service for contract processing."""

import json
import logging

import boto3

from app.config import settings

logger = logging.getLogger(__name__)


def invoke_process_contract(
    contract_id: str,
    user_id: str,
    file_url: str,
    filename: str,
    pinecone_namespace: str,
) -> dict:
    """Invoke the contract processing Lambda function asynchronously.

    Args:
        contract_id: UUID of the contract to process
        user_id: UUID of the owning user
        file_url: Presigned R2 download URL for the PDF
        filename: Original filename of the uploaded PDF
        pinecone_namespace: Pinecone namespace for vector storage

    Returns:
        Dict with the Lambda invocation status code
    """
    client = boto3.client(
        "lambda",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id_dynamo,
        aws_secret_access_key=settings.aws_secret_access_key_dynamo,
    )

    payload = {
        "contract_id": contract_id,
        "user_id": user_id,
        "file_url": file_url,
        "filename": filename,
        "pinecone_namespace": pinecone_namespace,
    }

    response = client.invoke(
        FunctionName=settings.lambda_process_function_name,
        InvocationType="Event",  # Async — don't wait for result
        Payload=json.dumps(payload),
    )

    logger.info(
        "Invoked Lambda %s for contract %s (status: %d)",
        settings.lambda_process_function_name,
        contract_id,
        response["StatusCode"],
    )

    return {"status_code": response["StatusCode"]}
