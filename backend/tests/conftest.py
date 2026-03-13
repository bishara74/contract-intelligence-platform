"""Shared test fixtures: test DB, mock auth, test client, mock services."""

import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.dependencies.auth import get_current_user
from app.main import app
from app.models.contract import Contract
from app.models.user import User

# ---------------------------------------------------------------------------
# Test database (SQLite async in-memory)
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite://"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture(autouse=True)
async def setup_database() -> AsyncGenerator[None, None]:
    """Create all tables before each test, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ---------------------------------------------------------------------------
# Test user
# ---------------------------------------------------------------------------

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
TEST_USER_CLERK_ID = "user_test_123"
TEST_USER_EMAIL = "testuser@example.com"


@pytest.fixture
def test_user() -> User:
    """Return a User object matching the mock auth dependency."""
    return User(
        id=TEST_USER_ID,
        clerk_id=TEST_USER_CLERK_ID,
        email=TEST_USER_EMAIL,
        full_name="Test User",
        tier="free",
    )


def _override_get_current_user(user: User):
    """Create an override callable that returns the given user."""
    async def _override() -> User:
        return user
    return _override


# ---------------------------------------------------------------------------
# Async test client (with mock auth + test DB)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client(test_user: User) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient with test DB and mock auth overrides."""
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user(test_user)

    # Ensure mock user exists in the test DB
    async with TestSessionLocal() as session:
        session.add(User(
            id=test_user.id,
            clerk_id=test_user.clerk_id,
            email=test_user.email,
            full_name=test_user.full_name,
            tier=test_user.tier,
        ))
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def unauthenticated_client() -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient with test DB but NO auth override (for testing 401s)."""
    app.dependency_overrides[get_db] = _override_get_db
    # Do NOT override get_current_user — real auth logic runs
    app.dependency_overrides.pop(get_current_user, None)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Sample contract fixture
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def sample_contract(test_user: User) -> Contract:
    """Insert a ready contract into the test DB and return it."""
    contract_id = uuid.uuid4()
    contract = Contract(
        id=contract_id,
        user_id=test_user.id,
        filename="test-contract.pdf",
        file_url="https://r2.example.com/contracts/test.pdf",
        file_size_bytes=12345,
        page_count=5,
        chunk_count=10,
        status="ready",
        pinecone_namespace=f"user_{test_user.id}_contract_{contract_id}",
    )
    async with TestSessionLocal() as session:
        # Use merge to avoid duplicate user errors when client fixture already inserted user
        await session.merge(User(
            id=test_user.id,
            clerk_id=test_user.clerk_id,
            email=test_user.email,
            full_name=test_user.full_name,
            tier=test_user.tier,
        ))
        session.add(contract)
        await session.commit()
        await session.refresh(contract)
    return contract


# ---------------------------------------------------------------------------
# Sample PDF bytes fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_pdf_bytes() -> bytes:
    """Return bytes of a minimal valid PDF with one page of text."""
    import fitz  # PyMuPDF

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "This is a test contract.\nSection 1: Terms and Conditions.\n"
                     "The parties agree to the following terms.")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


# ---------------------------------------------------------------------------
# Mock external services
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_r2() -> MagicMock:
    """Patch boto3 S3 client used by the storage service."""
    with patch("app.services.storage._client") as mock:
        s3 = MagicMock()
        s3.generate_presigned_url.return_value = "https://r2.example.com/presigned-url"
        s3.delete_object.return_value = {}
        mock.return_value = s3
        yield s3


@pytest.fixture
def mock_pinecone() -> MagicMock:
    """Patch Pinecone operations."""
    with patch("app.services.vector_store._pinecone_client") as mock_pc, \
         patch("app.services.vector_store.delete_namespace") as mock_del_svc, \
         patch("app.routers.contracts.delete_namespace") as mock_del_router:
        pc = MagicMock()
        index = MagicMock()
        index.query.return_value = MagicMock(matches=[])
        index.delete.return_value = None
        pc.Index.return_value = index
        mock_pc.return_value = pc
        mock_del_svc.return_value = None
        mock_del_router.return_value = None
        yield {"index": index, "delete_namespace": mock_del_svc}


@pytest.fixture
def mock_openai() -> MagicMock:
    """Patch LangChain OpenAI calls."""
    with patch("langchain_openai.ChatOpenAI") as mock_chat, \
         patch("langchain_openai.OpenAIEmbeddings") as mock_embed:
        chat_instance = MagicMock()
        chat_instance.invoke.return_value = MagicMock(content="Test AI response")
        mock_chat.return_value = chat_instance
        embed_instance = MagicMock()
        embed_instance.embed_query.return_value = [0.1] * 1536
        embed_instance.embed_documents.return_value = [[0.1] * 1536]
        mock_embed.return_value = embed_instance
        yield {"chat": chat_instance, "embeddings": embed_instance}


@pytest.fixture
def mock_dynamodb() -> MagicMock:
    """Patch DynamoDB table operations."""
    with patch("app.services.dynamodb._get_table") as mock:
        table = MagicMock()
        table.put_item.return_value = {}
        table.query.return_value = {"Items": [], "Count": 0}
        table.delete_item.return_value = {}
        mock.return_value = table
        yield table
