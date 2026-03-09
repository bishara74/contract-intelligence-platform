"""Pinecone vector store service using LangChain OpenAIEmbeddings."""

import logging
from typing import Optional

from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec

from app.config import settings
from app.services.pdf_parser import Chunk

logger = logging.getLogger(__name__)

BATCH_SIZE = 100
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536


def _pinecone_client() -> Pinecone:
    """Return an authenticated Pinecone client."""
    return Pinecone(api_key=settings.pinecone_api_key)


def _embeddings() -> OpenAIEmbeddings:
    """Return a LangChain OpenAIEmbeddings instance."""
    return OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        openai_api_key=settings.openai_api_key,
    )


def ensure_index_exists() -> None:
    """Create the Pinecone index if it doesn't already exist.

    Uses serverless spec on AWS us-east-1 (free tier compatible).
    Safe to call on every startup — no-ops if index already exists.
    """
    pc = _pinecone_client()
    existing = {idx.name for idx in pc.list_indexes()}

    if settings.pinecone_index_name not in existing:
        logger.info("Creating Pinecone index '%s'", settings.pinecone_index_name)
        pc.create_index(
            name=settings.pinecone_index_name,
            dimension=EMBEDDING_DIMENSIONS,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        logger.info("Pinecone index '%s' created", settings.pinecone_index_name)
    else:
        logger.info("Pinecone index '%s' already exists", settings.pinecone_index_name)


async def upsert_chunks(
    chunks: list[Chunk],
    contract_id: str,
    filename: str,
    namespace: str,
) -> None:
    """Embed and upsert contract chunks into Pinecone in batches of 100.

    Each vector includes metadata:
        contract_id, filename, page_number, chunk_index, chunk_text

    Args:
        chunks: Parsed chunks from pdf_parser
        contract_id: UUID string of the contract
        filename: Original filename (stored in metadata)
        namespace: Pinecone namespace to upsert into (format: contract_{id})
    """
    if not chunks:
        logger.warning("No chunks to upsert for contract %s", contract_id)
        return

    pc = _pinecone_client()
    index = pc.Index(settings.pinecone_index_name)
    embeddings = _embeddings()

    total_upserted = 0

    for batch_start in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[batch_start : batch_start + BATCH_SIZE]

        texts = [c.text for c in batch]
        vectors = embeddings.embed_documents(texts)

        records = []
        for chunk, vector in zip(batch, vectors):
            records.append({
                "id": f"{contract_id}_{chunk.chunk_index}",
                "values": vector,
                "metadata": {
                    "contract_id": contract_id,
                    "filename": filename,
                    "page_number": chunk.page_number,
                    "chunk_index": chunk.chunk_index,
                    "chunk_text": chunk.text,
                },
            })

        index.upsert(vectors=records, namespace=namespace)
        total_upserted += len(records)
        logger.info(
            "Upserted batch %d-%d (%d vectors) for contract %s",
            batch_start, batch_start + len(batch) - 1, len(records), contract_id,
        )

    logger.info("Total upserted: %d vectors for contract %s", total_upserted, contract_id)


def get_vector_store(namespace: str) -> PineconeVectorStore:
    """Return a LangChain PineconeVectorStore for a given namespace.

    Used by the RAG pipeline to build a retriever.

    Args:
        namespace: Pinecone namespace (format: contract_{id})
    """
    pc = _pinecone_client()
    index = pc.Index(settings.pinecone_index_name)
    return PineconeVectorStore(
        index=index,
        embedding=_embeddings(),
        namespace=namespace,
        text_key="chunk_text",
    )


def delete_namespace(namespace: str) -> None:
    """Delete all vectors in a Pinecone namespace.

    Args:
        namespace: Namespace to delete (format: contract_{id})
    """
    try:
        pc = _pinecone_client()
        index = pc.Index(settings.pinecone_index_name)
        index.delete(delete_all=True, namespace=namespace)
        logger.info("Deleted Pinecone namespace: %s", namespace)
    except Exception as e:
        logger.error("Failed to delete Pinecone namespace %s: %s", namespace, e)
        raise
