"""Celery tasks for contract processing, clause extraction, and risk analysis.

Each task has a corresponding `_sync` function that contains the actual logic
and can be called directly from FastAPI BackgroundTasks when Celery is not available.
"""

import logging
import uuid

import httpx

from app.celery_app import celery_app
from app.database import SyncSessionLocal
from app.models.clause import Clause
from app.models.contract import Contract
from app.models.risk import Risk
from app.services import storage
from app.services.pdf_parser import parse_pdf

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Standalone sync functions (used by both Celery tasks and BackgroundTasks)
# ---------------------------------------------------------------------------

def process_contract_sync(contract_id: str) -> None:
    """Download PDF from R2, parse + chunk, embed into Pinecone, mark ready."""
    logger.info("Starting process_contract_sync for %s", contract_id)
    session = SyncSessionLocal()
    try:
        contract = session.query(Contract).filter(
            Contract.id == uuid.UUID(contract_id)
        ).first()
        if not contract:
            logger.error("Contract %s not found", contract_id)
            return

        contract.status = "processing"
        session.commit()

        # Download PDF from R2
        object_key = storage.object_key_for_contract(contract_id)
        download_url = storage.generate_download_url(object_key, expires_in=300)

        with httpx.Client(timeout=60) as client:
            response = client.get(download_url)
            response.raise_for_status()
            pdf_bytes = response.content

        # Parse + chunk
        pages, chunks = parse_pdf(pdf_bytes)
        contract.page_count = len(pages)
        contract.chunk_count = len(chunks)
        session.flush()

        # Embed + upsert into Pinecone
        _sync_upsert_chunks(
            chunks=chunks,
            contract_id=contract_id,
            filename=contract.filename,
            namespace=contract.pinecone_namespace,
        )

        contract.status = "ready"
        session.commit()

        logger.info(
            "Contract %s processed: %d pages, %d chunks",
            contract_id, len(pages), len(chunks),
        )

    except Exception as exc:
        logger.exception("Processing failed for contract %s: %s", contract_id, exc)
        try:
            session.rollback()
            contract = session.query(Contract).filter(
                Contract.id == uuid.UUID(contract_id)
            ).first()
            if contract:
                contract.status = "error"
                contract.error_message = str(exc)
                session.commit()
        except Exception:
            session.rollback()
        raise
    finally:
        session.close()


def extract_clauses_sync(contract_id: str) -> None:
    """Download PDF, parse chunks, extract clauses via LLM, save to DB."""
    logger.info("Starting extract_clauses_sync for %s", contract_id)
    session = SyncSessionLocal()
    try:
        contract = session.query(Contract).filter(
            Contract.id == uuid.UUID(contract_id)
        ).first()
        if not contract:
            logger.error("Contract %s not found for clause extraction", contract_id)
            return

        # Download PDF from R2
        object_key = storage.object_key_for_contract(contract_id)
        download_url = storage.generate_download_url(object_key, expires_in=300)

        with httpx.Client(timeout=120) as client:
            response = client.get(download_url)
            response.raise_for_status()
            pdf_bytes = response.content

        # Parse to get chunks
        _, chunks = parse_pdf(pdf_bytes)

        # Extract clauses + summary (sync)
        extracted, summary = _sync_extract_clauses(chunks, contract_id)

        # Delete existing clauses (re-extraction)
        session.query(Clause).filter(
            Clause.contract_id == uuid.UUID(contract_id)
        ).delete()
        session.flush()

        # Persist new clauses
        valid_types = {
            "termination", "liability", "indemnification", "confidentiality",
            "payment_terms", "governing_law", "non_compete", "intellectual_property",
            "force_majeure", "dispute_resolution", "warranty", "insurance",
            "data_protection", "other",
        }
        for ec in extracted:
            clause = Clause(
                contract_id=uuid.UUID(contract_id),
                clause_type=ec.clause_type if ec.clause_type in valid_types else "other",
                title=ec.title,
                content=ec.content,
                page_number=ec.page_number,
                confidence_score=min(max(ec.confidence_score, 0.0), 1.0),
            )
            session.add(clause)

        # Update contract summary
        if summary:
            contract.summary = summary

        session.commit()
        logger.info(
            "Clause extraction complete for contract %s: %d clauses saved",
            contract_id, len(extracted),
        )

    except Exception as exc:
        logger.exception("Clause extraction failed for contract %s: %s", contract_id, exc)
        session.rollback()
        raise
    finally:
        session.close()


def analyze_risks_sync(contract_id: str) -> None:
    """Load clauses, run LLM risk analysis, save results to DB."""
    logger.info("Starting analyze_risks_sync for %s", contract_id)
    session = SyncSessionLocal()
    try:
        # Load all clauses
        clauses = (
            session.query(Clause)
            .filter(Clause.contract_id == uuid.UUID(contract_id))
            .order_by(Clause.confidence_score.desc())
            .all()
        )
        if not clauses:
            logger.warning("No clauses for contract %s — skipping risk analysis", contract_id)
            return

        from app.services.risk_analyzer import build_clauses_text
        clauses_text, type_to_clause_id = build_clauses_text(clauses)

        # Run LLM analysis (sync)
        identified_risks = _sync_analyze_risks(
            clauses_text=clauses_text,
            clause_type_map=type_to_clause_id,
            contract_id=contract_id,
        )

        # Delete previous risk analysis
        session.query(Risk).filter(
            Risk.contract_id == uuid.UUID(contract_id)
        ).delete()
        session.flush()

        # Persist new risks
        from app.services.risk_analyzer import SEVERITY_LEVELS
        for ir in identified_risks:
            clause_id: uuid.UUID | None = None
            if ir.related_clause_type and ir.related_clause_type in type_to_clause_id:
                try:
                    clause_id = uuid.UUID(type_to_clause_id[ir.related_clause_type])
                except ValueError:
                    pass

            severity = ir.severity if ir.severity in SEVERITY_LEVELS else "medium"

            risk = Risk(
                contract_id=uuid.UUID(contract_id),
                clause_id=clause_id,
                risk_type=ir.risk_type,
                severity=severity,
                title=ir.title,
                description=ir.description,
                recommendation=ir.recommendation,
            )
            session.add(risk)

        session.commit()
        logger.info(
            "Risk analysis complete for contract %s: %d risks saved",
            contract_id, len(identified_risks),
        )

    except Exception as exc:
        logger.exception("Risk analysis failed for contract %s: %s", contract_id, exc)
        session.rollback()
        raise
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Celery task wrappers (delegate to sync functions + add retry)
# ---------------------------------------------------------------------------

@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def process_contract_task(self, contract_id: str) -> None:
    """Celery wrapper for process_contract_sync with retry logic."""
    try:
        process_contract_sync(contract_id)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def extract_clauses_task(self, contract_id: str) -> None:
    """Celery wrapper for extract_clauses_sync with retry logic."""
    try:
        extract_clauses_sync(contract_id)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def analyze_risks_task(self, contract_id: str) -> None:
    """Celery wrapper for analyze_risks_sync with retry logic."""
    try:
        analyze_risks_sync(contract_id)
    except Exception as exc:
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Sync helper functions (initialize LLM/Pinecone clients inside each call)
# ---------------------------------------------------------------------------

def _sync_upsert_chunks(
    chunks: list,
    contract_id: str,
    filename: str,
    namespace: str,
) -> None:
    """Sync version of vector_store.upsert_chunks for Celery workers."""
    from langchain_openai import OpenAIEmbeddings
    from pinecone import Pinecone

    from app.config import settings

    if not chunks:
        return

    pc = Pinecone(api_key=settings.pinecone_api_key)
    index = pc.Index(settings.pinecone_index_name)
    embeddings = OpenAIEmbeddings(
        model="text-embedding-3-small",
        openai_api_key=settings.openai_api_key,
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


def _sync_extract_clauses(chunks: list, contract_id: str) -> tuple:
    """Sync version of clause_extractor.extract_clauses for Celery workers."""
    from langchain.output_parsers import PydanticOutputParser
    from langchain.prompts import PromptTemplate
    from langchain_openai import ChatOpenAI

    from app.config import settings
    from app.services.clause_extractor import (
        CHUNK_BATCH_SIZE,
        EXTRACTION_TEMPLATE,
        SUMMARY_TEMPLATE,
        ContractSummary,
        ExtractedClause,
        ExtractedClauses,
        _deduplicate_clauses,
    )

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.0,
        openai_api_key=settings.openai_api_key,
    )
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
            response = llm.invoke(prompt_text)
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

    deduped = _deduplicate_clauses(all_clauses)
    logger.info(
        "Contract %s: %d raw clauses -> %d after dedup",
        contract_id, len(all_clauses), len(deduped),
    )

    # Summary generation
    summary_text = "\n\n".join(c.text for c in chunks[:6])
    contract_summary = None
    try:
        prompt_text = summary_prompt.format(contract_text=summary_text)
        response = llm.invoke(prompt_text)
        parsed_summary = summary_parser.parse(response.content)
        contract_summary = parsed_summary.summary
        logger.info("Generated summary for contract %s", contract_id)
    except Exception as e:
        logger.warning("Summary generation failed for contract %s: %s", contract_id, e)

    return deduped, contract_summary


def _sync_analyze_risks(
    clauses_text: str,
    clause_type_map: dict[str, str],
    contract_id: str,
) -> list:
    """Sync version of risk_analyzer.analyze_risks for Celery workers."""
    from langchain.output_parsers import PydanticOutputParser
    from langchain.prompts import PromptTemplate
    from langchain_openai import ChatOpenAI

    from app.config import settings
    from app.services.risk_analyzer import RISK_ANALYSIS_PROMPT, RiskAnalysisResult

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.0,
        openai_api_key=settings.openai_api_key,
    )
    parser = PydanticOutputParser(pydantic_object=RiskAnalysisResult)

    prompt = PromptTemplate(
        template=RISK_ANALYSIS_PROMPT,
        input_variables=["clauses_text"],
        partial_variables={"format_instructions": parser.get_format_instructions()},
    )

    prompt_text = prompt.format(clauses_text=clauses_text)
    response = llm.invoke(prompt_text)
    result = parser.parse(response.content)

    logger.info(
        "Risk analysis for contract %s: %d risks identified",
        contract_id, len(result.risks),
    )
    return result.risks
