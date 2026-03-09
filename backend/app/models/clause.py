import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

CLAUSE_TYPES = (
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
)


class Clause(Base):
    __tablename__ = "clauses"
    __table_args__ = (Index("ix_clauses_contract_id", "contract_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False
    )
    clause_type: Mapped[str] = mapped_column(
        Enum(*CLAUSE_TYPES, name="clause_type"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    contract: Mapped["Contract"] = relationship("Contract", back_populates="clauses")  # noqa: F821
    risks: Mapped[list["Risk"]] = relationship("Risk", back_populates="clause")  # noqa: F821
