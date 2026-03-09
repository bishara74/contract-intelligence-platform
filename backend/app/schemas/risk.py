import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

Severity = Literal["low", "medium", "high", "critical"]


class RiskResponse(BaseModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    clause_id: Optional[uuid.UUID]
    risk_type: str
    severity: Severity
    title: str
    description: str
    recommendation: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RisksResponse(BaseModel):
    risks: list[RiskResponse]
    severity_counts: dict[str, int]
    total: int
