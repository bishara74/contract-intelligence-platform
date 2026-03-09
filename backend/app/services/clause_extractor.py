"""Clause extraction service using LangChain structured output (Pydantic parser)."""

import logging
from typing import List, Optional

from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.config import settings
from app.services.pdf_parser import Chunk

logger = logging.getLogger(__name__)

# Process this many chunks per LLM call to stay within context window
CHUNK_BATCH_SIZE = 8

CLAUSE_TYPES = [
    "termination", "liability", "indemnification", "confidentiality",
    "payment_terms", "governing_law", "non_compete", "intellectual_property",
    "force_majeure", "dispute_resolution", "warranty", "insurance",
    "data_protection", "other",
]


# ── Pydantic schemas for structured output ────────────────────────────────────

class ExtractedClause(BaseModel):
    clause_type: str = Field(description=f"One of: {', '.join(CLAUSE_TYPES)}")
    title: str = Field(description="Short descriptive title for the clause (5-10 words)")
    content: str = Field(description="The full clause text, quoted verbatim from the contract")
    page_number: int = Field(description="Page number where this clause appears")
    confidence_score: float = Field(description="Confidence 0.0-1.0 that this is the correct clause type")


class ExtractedClauses(BaseModel):
    clauses: List[ExtractedClause] = Field(
        description="List of contract clauses found in the provided text. Empty list if none found."
    )


class ContractSummary(BaseModel):
    summary: str = Field(
        description="3-4 sentence plain-English summary of the contract: parties, purpose, key terms, duration."
    )


# ── LLM setup ─────────────────────────────────────────────────────────────────

def _llm() -> ChatOpenAI:
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.0,
        openai_api_key=settings.openai_api_key,
    )


# ── Extraction ────────────────────────────────────────────────────────────────

EXTRACTION_TEMPLATE = """\
You are a contract analysis expert. Extract all legal clauses from the contract text below.

For each clause you find, identify:
- The clause type (one of the allowed types)
- A short descriptive title
- The exact clause content (verbatim)
- The page number
- Your confidence score (0.0 to 1.0)

Only extract clauses that are clearly present. Do not invent clauses.

{format_instructions}

Contract text (pages {page_range}):
\"\"\"
{contract_text}
\"\"\"
"""

SUMMARY_TEMPLATE = """\
You are a contract analysis expert. Write a 3-4 sentence plain-English summary of this contract.
Include: the parties involved, the purpose/nature of the agreement, key obligations, and the duration or termination conditions if present.

{format_instructions}

Contract text:
\"\"\"
{contract_text}
\"\"\"
"""


async def extract_clauses(
    chunks: list[Chunk],
    contract_id: str,
) -> tuple[list[ExtractedClause], Optional[str]]:
    """Extract clauses from contract chunks in batches and generate a summary.

    Args:
        chunks: All chunks from the contract (from pdf_parser)
        contract_id: For logging purposes

    Returns:
        Tuple of (deduplicated clauses, summary string)
    """
    llm = _llm()
    clause_parser = PydanticOutputParser(pydantic_object=ExtractedClauses)
    summary_parser = PydanticOutputParser(pydantic_object=ContractSummary)

    extraction_prompt = PromptTemplate(
        template=EXTRACTION_TEMPLATE,
        input_variables=["contract_text", "page_range"],
        partial_variables={"format_instructions": clause_parser.get_format_instructions()},
    )

    summary_prompt = PromptTemplate(
        template=SUMMARY_TEMPLATE,
        input_variables=["contract_text"],
        partial_variables={"format_instructions": summary_parser.get_format_instructions()},
    )

    all_clauses: list[ExtractedClause] = []

    # ── Batch extraction ──────────────────────────────────────────────────────
    for batch_start in range(0, len(chunks), CHUNK_BATCH_SIZE):
        batch = chunks[batch_start : batch_start + CHUNK_BATCH_SIZE]
        combined_text = "\n\n".join(
            f"[Page {c.page_number}]\n{c.text}" for c in batch
        )
        pages = sorted({c.page_number for c in batch})
        page_range = f"{pages[0]}-{pages[-1]}" if len(pages) > 1 else str(pages[0])

        try:
            prompt_text = extraction_prompt.format(
                contract_text=combined_text,
                page_range=page_range,
            )
            response = await llm.ainvoke(prompt_text)
            parsed = clause_parser.parse(response.content)
            all_clauses.extend(parsed.clauses)

            logger.info(
                "Batch %d-%d: extracted %d clauses for contract %s",
                batch_start, batch_start + len(batch) - 1,
                len(parsed.clauses), contract_id,
            )
        except Exception as e:
            logger.warning(
                "Clause extraction failed for batch %d-%d of contract %s: %s",
                batch_start, batch_start + len(batch) - 1, contract_id, e,
            )
            continue

    # ── Deduplication ─────────────────────────────────────────────────────────
    deduped = _deduplicate_clauses(all_clauses)
    logger.info(
        "Contract %s: %d raw clauses → %d after dedup",
        contract_id, len(all_clauses), len(deduped),
    )

    # ── Summary generation (use first 6 chunks for brevity) ──────────────────
    summary_text = "\n\n".join(c.text for c in chunks[:6])
    contract_summary: Optional[str] = None
    try:
        prompt_text = summary_prompt.format(contract_text=summary_text)
        response = await llm.ainvoke(prompt_text)
        parsed_summary = summary_parser.parse(response.content)
        contract_summary = parsed_summary.summary
        logger.info("Generated summary for contract %s", contract_id)
    except Exception as e:
        logger.warning("Summary generation failed for contract %s: %s", contract_id, e)

    return deduped, contract_summary


def _deduplicate_clauses(clauses: list[ExtractedClause]) -> list[ExtractedClause]:
    """Remove duplicate clauses that appear across chunk boundaries.

    Two clauses are considered duplicates if they share the same type AND
    have highly overlapping content (one contains the other, or 80%+ token overlap).
    Keeps the clause with the higher confidence score.
    """
    if not clauses:
        return []

    # Sort by confidence descending so we keep the best version
    sorted_clauses = sorted(clauses, key=lambda c: c.confidence_score, reverse=True)
    deduped: list[ExtractedClause] = []

    for candidate in sorted_clauses:
        is_duplicate = False
        candidate_words = set(candidate.content.lower().split())

        for existing in deduped:
            if existing.clause_type != candidate.clause_type:
                continue
            existing_words = set(existing.content.lower().split())
            if not candidate_words or not existing_words:
                continue

            # Jaccard similarity
            intersection = len(candidate_words & existing_words)
            union = len(candidate_words | existing_words)
            similarity = intersection / union if union > 0 else 0.0

            if similarity > 0.6:
                is_duplicate = True
                break

        if not is_duplicate:
            deduped.append(candidate)

    return deduped
