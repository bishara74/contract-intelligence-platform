"""Cloudflare R2 storage service (S3-compatible) via boto3."""

import logging
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)

# R2 requires path-style addressing
_s3_config = Config(signature_version="s3v4", s3={"addressing_style": "path"})


def _client():
    """Create a boto3 S3 client pointed at Cloudflare R2."""
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=_s3_config,
        region_name="auto",
    )


def generate_upload_url(object_key: str, content_type: str = "application/pdf") -> str:
    """Generate a presigned PUT URL for direct client-to-R2 upload.

    Args:
        object_key: The R2 object key (e.g. contracts/<contract_id>.pdf)
        content_type: MIME type of the file being uploaded

    Returns:
        Presigned URL valid for 15 minutes
    """
    client = _client()
    url: str = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=900,  # 15 minutes
    )
    return url


def generate_download_url(object_key: str, expires_in: int = 3600) -> str:
    """Generate a presigned GET URL for reading a stored file.

    Args:
        object_key: The R2 object key
        expires_in: Seconds until the URL expires (default 1 hour)

    Returns:
        Presigned GET URL
    """
    client = _client()
    url: str = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.r2_bucket_name, "Key": object_key},
        ExpiresIn=expires_in,
    )
    return url


def delete_object(object_key: str) -> None:
    """Delete an object from R2.

    Args:
        object_key: The R2 object key to delete
    """
    try:
        client = _client()
        client.delete_object(Bucket=settings.r2_bucket_name, Key=object_key)
        logger.info("Deleted R2 object: %s", object_key)
    except ClientError as e:
        logger.error("Failed to delete R2 object %s: %s", object_key, e)
        raise


def object_key_for_contract(contract_id: str) -> str:
    """Return the canonical R2 object key for a contract PDF."""
    return f"contracts/{contract_id}.pdf"
