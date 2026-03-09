import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class UploadUrlRequest(BaseModel):
    filename: str
    file_size_bytes: int


class UploadUrlResponse(BaseModel):
    contract_id: uuid.UUID
    upload_url: str


class ContractResponse(BaseModel):
    id: uuid.UUID
    filename: str
    file_url: str
    file_size_bytes: int
    page_count: int
    chunk_count: int
    status: Literal["uploading", "processing", "ready", "error"]
    error_message: Optional[str]
    summary: Optional[str]
    pinecone_namespace: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
