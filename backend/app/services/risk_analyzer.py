"""Risk analysis service using LangChain structured output."""

import logging
from typing import List, Optional

from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

SEVERITY_LEVELS = ["low", "medium", "high", "critical"]


# ── Pydantic schemas for structured output ────────────────────────────────────

class IdentifiedRisk(BaseModel):
    risk_type: str = Field(description="Short category label, e.g. 'auto_renewal', 'uncapped_liability'")
    severity: str = Field(description="One of: low, medium, high, critical")
    title: str = Field(description="Concise risk title (5-10 words)")
    description: str = Field(description="2-3 sentence explanation of why this is a risk and its potential impact")
    recommendation: str = Field(description="Specific, actionable recommendation to mitigate this risk")
    related_clause_type: Optional[str] = Field(
        default=None,
        description="The clause_type from the contract this risk relates to, or null if it's a missing clause"
    )


class RiskAnalysisResult(BaseModel):
    risks: List[IdentifiedRisk] = Field(
        description="All identified risks. Empty list if no risks found."
    )


# ── Prompt ────────────────────────────────────────────────────────────────────

RISK_ANALYSIS_PROMPT = """\
You are a contract risk analysis expert. Analyze the contract clauses below and identify risks.

Check specifically for ALL of the following risk categories (flag each one found):
1. AUTO_RENEWAL — clauses that auto-renew without clear opt-out or notice period
2. UNCAPPED_LIABILITY — unlimited or uncapped liability exposure for one party
3. ONE_SIDED_TERMINATION — termination rights that heavily favor one party
4. BROAD_NON_COMPETE — overly broad non-compete, non-solicitation, or exclusivity clauses
5. MISSING_FORCE_MAJEURE — no force majeure clause present
6. MISSING_DATA_PROTECTION — no data protection, privacy, or GDPR compliance clause
7. MISSING_DISPUTE_RESOLUTION — no dispute resolution or arbitration clause
8. MISSING_INSURANCE — no insurance or indemnification coverage requirement
9. VAGUE_PAYMENT_TERMS — payment terms are ambiguous, missing due dates, or penalties unclear
10. UNFAVORABLE_GOVERNING_LAW — governing law or jurisdiction that may be disadvantageous
11. UNLIMITED_INDEMNIFICATION — broad indemnification obligation with no cap or carve-outs

For missing clauses (items 5-8), if the clause IS present, do not flag it as a risk.
Only flag risks that are genuinely present or genuinely absent.
Be conservative — only flag clear, material risks.

Severity guidelines:
- critical: immediate legal/financial exposure, deal-breaker level
- high: significant risk requiring negotiation before signing
- medium: notable concern that should be addressed
- low: minor issue or best-practice suggestion

{format_instructions}

Contract clauses:
\"\"\"
{clauses_text}
\"\"\"
"""


# ── Main analysis function ────────────────────────────────────────────────────

async def analyze_risks(
    clauses_text: str,
    clause_type_map: dict[str, str],
    contract_id: str,
) -> list[IdentifiedRisk]:
    """Run risk analysis against the extracted contract clauses.

    Args:
        clauses_text: All clause content concatenated with type headers
        clause_type_map: Maps clause_type → clause_id for linking risks to clauses
        contract_id: For logging

    Returns:
        List of identified risks
    """
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

    try:
        response = await llm.ainvoke(prompt_text)
        result = parser.parse(response.content)
        logger.info(
            "Risk analysis for contract %s: %d risks identified",
            contract_id, len(result.risks),
        )
        return result.risks
    except Exception as e:
        logger.exception("Risk analysis failed for contract %s: %s", contract_id, e)
        raise


def build_clauses_text(clauses: list) -> tuple[str, dict[str, str]]:
    """Format extracted clauses into a prompt-ready string and build a type→id map.

    Args:
        clauses: List of Clause ORM objects

    Returns:
        Tuple of (formatted text for prompt, {clause_type: str(clause_id)} map)
    """
    lines: list[str] = []
    type_to_id: dict[str, str] = {}

    for clause in clauses:
        clause_type = clause.clause_type
        # Keep the first clause of each type for linking (highest confidence is loaded first)
        if clause_type not in type_to_id:
            type_to_id[clause_type] = str(clause.id)

        lines.append(f"[{clause_type.upper()}] {clause.title}\n{clause.content}\n")

    return "\n".join(lines), type_to_id
