"""Tests for PDF text extraction and chunking."""

import fitz  # PyMuPDF

from app.services.pdf_parser import Chunk, PageText, chunk_pages, extract_pages, parse_pdf


def _make_pdf(texts: list[str]) -> bytes:
    """Create a PDF with one page per text string."""
    doc = fitz.open()
    for text in texts:
        page = doc.new_page()
        page.insert_text((72, 72), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_parse_pdf_extracts_text(sample_pdf_bytes: bytes) -> None:
    """Given PDF bytes, extract_pages returns text with page numbers."""
    pages = extract_pages(sample_pdf_bytes)
    assert len(pages) == 1
    assert pages[0].page_number == 1
    assert "test contract" in pages[0].text.lower()


def test_parse_pdf_empty_document() -> None:
    """Empty PDF (page with no text) returns empty list."""
    doc = fitz.open()
    doc.new_page()  # blank page
    pdf_bytes = doc.tobytes()
    doc.close()

    pages = extract_pages(pdf_bytes)
    assert pages == []


def test_chunking_creates_correct_sizes() -> None:
    """Chunks are within the configured chunk_size limit (1000 chars)."""
    # Build PageText directly to avoid PDF text rendering limits
    long_text = "This is a sentence about contract terms. " * 100
    pages = [PageText(page_number=1, text=long_text)]
    chunks = chunk_pages(pages)

    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk.text) <= 1000


def test_chunking_preserves_page_numbers() -> None:
    """Each chunk tracks its source page number."""
    pdf_bytes = _make_pdf([
        "Page one content about liability.",
        "Page two content about indemnification.",
    ])
    pages = extract_pages(pdf_bytes)
    chunks = chunk_pages(pages)

    page_numbers = {c.page_number for c in chunks}
    assert 1 in page_numbers
    assert 2 in page_numbers


def test_chunk_overlap() -> None:
    """Adjacent chunks from the same page share overlapping content."""
    # Build PageText directly to avoid PDF text rendering limits
    long_text = "The parties hereby agree to the following contractual obligations. " * 80
    pages = [PageText(page_number=1, text=long_text)]
    chunks = chunk_pages(pages)

    assert len(chunks) >= 2
    # Check that consecutive chunks share some text (overlap)
    chunk_a = chunks[0].text
    chunk_b = chunks[1].text
    # With 200-char overlap, the end of chunk_a should appear at start of chunk_b
    overlap_found = any(
        chunk_a[i:i+30] in chunk_b
        for i in range(max(0, len(chunk_a) - 250), len(chunk_a) - 30)
    )
    assert overlap_found, "Expected overlapping content between adjacent chunks"
