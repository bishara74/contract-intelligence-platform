"""Tests for R2 storage service."""

from unittest.mock import MagicMock, patch

from app.services.storage import (
    delete_object,
    generate_download_url,
    generate_upload_url,
    object_key_for_contract,
)


def _make_mock_s3() -> MagicMock:
    """Create a mock S3 client."""
    s3 = MagicMock()
    s3.generate_presigned_url.return_value = "https://r2.example.com/presigned"
    s3.delete_object.return_value = {}
    return s3


def test_generate_upload_url() -> None:
    """generate_upload_url returns a presigned URL string."""
    s3 = _make_mock_s3()
    with patch("app.services.storage._client", return_value=s3):
        url = generate_upload_url("contracts/abc.pdf")

    assert isinstance(url, str)
    assert "presigned" in url
    s3.generate_presigned_url.assert_called_once_with(
        "put_object",
        Params={
            "Bucket": "contract-intelligence",
            "Key": "contracts/abc.pdf",
            "ContentType": "application/pdf",
        },
        ExpiresIn=900,
    )


def test_generate_download_url() -> None:
    """generate_download_url returns a presigned URL string."""
    s3 = _make_mock_s3()
    with patch("app.services.storage._client", return_value=s3):
        url = generate_download_url("contracts/abc.pdf")

    assert isinstance(url, str)
    assert "presigned" in url
    s3.generate_presigned_url.assert_called_once_with(
        "get_object",
        Params={
            "Bucket": "contract-intelligence",
            "Key": "contracts/abc.pdf",
        },
        ExpiresIn=3600,
    )


def test_delete_file() -> None:
    """delete_object doesn't raise on successful deletion."""
    s3 = _make_mock_s3()
    with patch("app.services.storage._client", return_value=s3):
        delete_object("contracts/abc.pdf")

    s3.delete_object.assert_called_once_with(
        Bucket="contract-intelligence",
        Key="contracts/abc.pdf",
    )


def test_object_key_for_contract() -> None:
    """object_key_for_contract returns the expected format."""
    key = object_key_for_contract("some-uuid-123")
    assert key == "contracts/some-uuid-123.pdf"
