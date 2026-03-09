import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Risk(Base):
    __tablename__ = "risks"
    __table_args__ = (Index("ix_risks_contract_id", "contract_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False
    )
    clause_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("clauses.id", ondelete="SET NULL"), nullable=True
    )
    risk_type: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[str] = mapped_column(
        Enum("low", "medium", "high", "critical", name="risk_severity"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    contract: Mapped["Contract"] = relationship("Contract", back_populates="risks")  # noqa: F821
    clause: Mapped[Optional["Clause"]] = relationship("Clause", back_populates="risks")  # noqa: F821
