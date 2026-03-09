import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    question: str


class SourceChunk(BaseModel):
    page: int
    text: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    message_id: uuid.UUID


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    role: Literal["user", "assistant"]
    content: str
    source_chunks: Optional[list[SourceChunk]]
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]
