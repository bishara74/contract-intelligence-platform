"""Tests for contract CRUD endpoints with user isolation."""

import uuid
from unittest.mock import MagicMock

from httpx import AsyncClient

from app.models.contract import Contract
from app.models.user import User
from tests.conftest import TEST_USER_ID, TestSessionLocal


async def test_get_upload_url(client: AsyncClient, mock_r2: MagicMock) -> None:
    """POST /api/v1/contracts/upload-url returns presigned URL and contract_id."""
    resp = await client.post(
        "/api/v1/contracts/upload-url",
        json={"filename": "contract.pdf", "file_size_bytes": 5000},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "contract_id" in body["data"]
    assert "upload_url" in body["data"]


async def test_list_contracts_empty(client: AsyncClient) -> None:
    """GET /api/v1/contracts returns empty list for new user."""
    resp = await client.get("/api/v1/contracts")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"] == []


async def test_list_contracts_returns_user_contracts(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """GET /api/v1/contracts only returns contracts belonging to current user."""
    resp = await client.get("/api/v1/contracts")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert len(body["data"]) == 1
    assert body["data"][0]["id"] == str(sample_contract.id)


async def test_get_contract_by_id(
    client: AsyncClient, sample_contract: Contract
) -> None:
    """GET /api/v1/contracts/{id} returns contract details."""
    resp = await client.get(f"/api/v1/contracts/{sample_contract.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["id"] == str(sample_contract.id)
    assert body["data"]["filename"] == "test-contract.pdf"
    assert body["data"]["status"] == "ready"


async def test_get_other_users_contract_returns_403(
    client: AsyncClient, test_user: User
) -> None:
    """Accessing another user's contract returns 403."""
    other_user_id = uuid.uuid4()
    contract_id = uuid.uuid4()
    async with TestSessionLocal() as session:
        # Create another user
        other_user = User(
            id=other_user_id,
            clerk_id="clerk_other_user",
            email="other@example.com",
        )
        session.add(other_user)
        contract = Contract(
            id=contract_id,
            user_id=other_user_id,
            filename="other.pdf",
            file_url="https://r2.example.com/other.pdf",
            file_size_bytes=1000,
            status="ready",
            pinecone_namespace=f"user_{other_user_id}_contract_{contract_id}",
        )
        session.add(contract)
        await session.commit()

    resp = await client.get(f"/api/v1/contracts/{contract_id}")
    assert resp.status_code == 403


async def test_delete_contract(
    client: AsyncClient, sample_contract: Contract, mock_r2: MagicMock, mock_pinecone: MagicMock
) -> None:
    """DELETE removes contract from DB."""
    resp = await client.delete(f"/api/v1/contracts/{sample_contract.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["deleted"] is True

    # Verify it's gone
    resp2 = await client.get(f"/api/v1/contracts/{sample_contract.id}")
    assert resp2.status_code == 404


async def test_delete_other_users_contract_returns_403(
    client: AsyncClient, test_user: User
) -> None:
    """Can't delete another user's contract."""
    other_user_id = uuid.uuid4()
    contract_id = uuid.uuid4()
    async with TestSessionLocal() as session:
        other_user = User(
            id=other_user_id,
            clerk_id="clerk_other_delete",
            email="otherdelete@example.com",
        )
        session.add(other_user)
        contract = Contract(
            id=contract_id,
            user_id=other_user_id,
            filename="other.pdf",
            file_url="https://r2.example.com/other.pdf",
            file_size_bytes=1000,
            status="ready",
            pinecone_namespace=f"user_{other_user_id}_contract_{contract_id}",
        )
        session.add(contract)
        await session.commit()

    resp = await client.delete(f"/api/v1/contracts/{contract_id}")
    assert resp.status_code == 403


async def test_duplicate_filename_returns_409(
    client: AsyncClient, mock_r2: MagicMock
) -> None:
    """Uploading a contract with the same filename for the same user returns 409."""
    # First upload succeeds
    resp1 = await client.post(
        "/api/v1/contracts/upload-url",
        json={"filename": "duplicate.pdf", "file_size_bytes": 5000},
    )
    assert resp1.status_code == 200

    # Second upload with same filename returns 409
    resp2 = await client.post(
        "/api/v1/contracts/upload-url",
        json={"filename": "duplicate.pdf", "file_size_bytes": 5000},
    )
    assert resp2.status_code == 409
    assert "already exists" in resp2.json()["error"]["message"]


async def test_different_user_can_upload_same_filename(
    client: AsyncClient, test_user: User, mock_r2: MagicMock
) -> None:
    """Different users can upload files with the same filename (no cross-user conflict)."""
    # Current user uploads a file
    resp1 = await client.post(
        "/api/v1/contracts/upload-url",
        json={"filename": "shared-name.pdf", "file_size_bytes": 5000},
    )
    assert resp1.status_code == 200

    # Create a different user and a contract with same filename directly in DB
    other_user_id = uuid.uuid4()
    contract_id = uuid.uuid4()
    async with TestSessionLocal() as session:
        other_user = User(
            id=other_user_id,
            clerk_id="clerk_other_dup",
            email="otherdup@example.com",
        )
        session.add(other_user)
        contract = Contract(
            id=contract_id,
            user_id=other_user_id,
            filename="shared-name.pdf",
            file_url="https://r2.example.com/other.pdf",
            file_size_bytes=5000,
            status="ready",
            pinecone_namespace=f"user_{other_user_id}_contract_{contract_id}",
        )
        session.add(contract)
        await session.commit()

    # Original user should still only have their one contract (no conflict from other user)
    resp2 = await client.get("/api/v1/contracts")
    assert resp2.status_code == 200
    filenames = [c["filename"] for c in resp2.json()["data"]]
    assert "shared-name.pdf" in filenames
