import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

ClauseType = Literal[
    "termination",
    "liability",
    "indemnification",
    "confidentiality",
    "payment_terms",
    "governing_law",
    "non_compete",
    "intellectual_property",
    "force_majeure",
    "dispute_resolution",
    "warranty",
    "insurance",
    "data_protection",
    "other",
]


class ClauseResponse(BaseModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    clause_type: ClauseType
    title: str
    content: str
    page_number: int
    confidence_score: float
    created_at: datetime

    model_config = {"from_attributes": True}


class ClausesGroupedResponse(BaseModel):
    clauses_by_type: dict[str, list[ClauseResponse]]
    total: int
