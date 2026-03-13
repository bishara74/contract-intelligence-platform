"""AWS Lambda handler for PDF contract processing.

Pipeline: Download PDF from R2 → Parse with PyMuPDF → Chunk with LangChain →
Embed with OpenAI → Upsert to Pinecone → Update contract status in PostgreSQL.

This is a standalone function — it does NOT import from backend/app/.
"""

import json
import logging
import os
from dataclasses import dataclass
from typing import Any

import fitz  # PyMuPDF
import httpx
import psycopg2
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from pinecone import Pinecone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class PageText:
    page_number: int  # 1-indexed
    text: str


@dataclass
class Chunk:
    chunk_index: int
    text: str
    page_number: int


# ---------------------------------------------------------------------------
# PDF parsing (mirrors backend/app/services/pdf_parser.py)
# ---------------------------------------------------------------------------

def extract_pages(pdf_bytes: bytes) -> list[PageText]:
    """Extract text from each page of a PDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: list[PageText] = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text").strip()
        if text:
            pages.append(PageText(page_number=page_num + 1, text=text))
    doc.close()
    logger.info("Extracted text from %d pages", len(pages))
    return pages


def chunk_pages(pages: list[PageText]) -> list[Chunk]:
    """Split page texts into overlapping chunks, preserving page attribution."""
    chunks: list[Chunk] = []
    chunk_index = 0
    for page in pages:
        page_chunks = _splitter.split_text(page.text)
        for text in page_chunks:
            if text.strip():
                chunks.append(Chunk(
                    chunk_index=chunk_index,
                    text=text.strip(),
                    page_number=page.page_number,
                ))
                chunk_index += 1
    logger.info("Created %d chunks from %d pages", len(chunks), len(pages))
    return chunks


def parse_pdf(pdf_bytes: bytes) -> tuple[list[PageText], list[Chunk]]:
    """Full pipeline: extract pages then chunk."""
    pages = extract_pages(pdf_bytes)
    chunks = chunk_pages(pages)
    return pages, chunks


# ---------------------------------------------------------------------------
# Pinecone upsert
# ---------------------------------------------------------------------------

def upsert_chunks(
    chunks: list[Chunk],
    contract_id: str,
    filename: str,
    namespace: str,
) -> None:
    """Generate embeddings and batch-upsert to Pinecone."""
    if not chunks:
        return

    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    index = pc.Index(os.environ["PINECONE_INDEX_NAME"])
    embeddings = OpenAIEmbeddings(
        model="text-embedding-3-small",
        openai_api_key=os.environ["OPENAI_API_KEY"],
    )

    batch_size = 100
    total_upserted = 0

    for batch_start in range(0, len(chunks), batch_size):
        batch = chunks[batch_start : batch_start + batch_size]
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


# ---------------------------------------------------------------------------
# Database status updates (raw SQL via psycopg2)
# ---------------------------------------------------------------------------

def _update_contract_status(
    contract_id: str,
    status: str,
    page_count: int = 0,
    chunk_count: int = 0,
    error_message: str | None = None,
) -> None:
    """Update contract status in PostgreSQL."""
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    try:
        if status == "ready":
            cur.execute(
                "UPDATE contracts SET status=%s, page_count=%s, chunk_count=%s, updated_at=NOW() WHERE id=%s",
                (status, page_count, chunk_count, contract_id),
            )
        else:
            cur.execute(
                "UPDATE contracts SET status=%s, error_message=%s, updated_at=NOW() WHERE id=%s",
                (status, error_message, contract_id),
            )
        conn.commit()
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------

def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """AWS Lambda entry point for contract PDF processing.

    Expected event payload:
        contract_id: UUID string
        user_id: UUID string
        file_url: Presigned R2 download URL
        filename: Original PDF filename
        pinecone_namespace: Pinecone namespace for this contract
    """
    contract_id = event["contract_id"]
    filename = event["filename"]
    file_url = event["file_url"]
    pinecone_namespace = event["pinecone_namespace"]

    logger.info("Processing contract %s (%s)", contract_id, filename)

    try:
        # 1. Download PDF from presigned R2 URL
        with httpx.Client(timeout=60) as client:
            response = client.get(file_url)
            response.raise_for_status()
            pdf_bytes = response.content

        logger.info("Downloaded PDF: %d bytes", len(pdf_bytes))

        # 2-3. Parse + chunk
        pages, chunks = parse_pdf(pdf_bytes)

        # 4-5. Embed + upsert to Pinecone
        upsert_chunks(
            chunks=chunks,
            contract_id=contract_id,
            filename=filename,
            namespace=pinecone_namespace,
        )

        # 6. Update contract status to ready
        _update_contract_status(
            contract_id=contract_id,
            status="ready",
            page_count=len(pages),
            chunk_count=len(chunks),
        )

        result = {
            "contract_id": contract_id,
            "page_count": len(pages),
            "chunk_count": len(chunks),
            "status": "ready",
        }
        logger.info("Contract %s processed successfully: %s", contract_id, result)

        return {
            "statusCode": 200,
            "body": json.dumps(result),
        }

    except Exception as exc:
        logger.exception("Processing failed for contract %s: %s", contract_id, exc)

        # 7. Update contract status to error
        try:
            _update_contract_status(
                contract_id=contract_id,
                status="error",
                error_message=str(exc)[:500],
            )
        except Exception as db_exc:
            logger.error("Failed to update error status in DB: %s", db_exc)

        return {
            "statusCode": 500,
            "body": json.dumps({
                "contract_id": contract_id,
                "status": "error",
                "error": str(exc)[:500],
            }),
        }
