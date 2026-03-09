"""PDF parsing service: text extraction with PyMuPDF + chunking with LangChain."""

import logging
from dataclasses import dataclass

import fitz  # PyMuPDF
from langchain.text_splitter import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
)


@dataclass
class PageText:
    page_number: int  # 1-indexed
    text: str


@dataclass
class Chunk:
    chunk_index: int
    text: str
    page_number: int  # page where this chunk originated


def extract_pages(pdf_bytes: bytes) -> list[PageText]:
    """Extract text from each page of a PDF.

    Args:
        pdf_bytes: Raw PDF file bytes

    Returns:
        List of PageText objects (one per page, 1-indexed)
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: list[PageText] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")  # plain text extraction
        text = text.strip()
        if text:
            pages.append(PageText(page_number=page_num + 1, text=text))

    doc.close()
    logger.info("Extracted text from %d pages", len(pages))
    return pages


def chunk_pages(pages: list[PageText]) -> list[Chunk]:
    """Split page texts into overlapping chunks, preserving page number attribution.

    Each chunk is tagged with the page it originated from. When a chunk spans
    text that was split across pages, it gets the page of the first character.

    Args:
        pages: List of PageText from extract_pages()

    Returns:
        Ordered list of Chunk objects
    """
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
    """Full pipeline: extract pages then chunk.

    Args:
        pdf_bytes: Raw PDF file bytes

    Returns:
        Tuple of (pages, chunks)
    """
    pages = extract_pages(pdf_bytes)
    chunks = chunk_pages(pages)
    return pages, chunks
