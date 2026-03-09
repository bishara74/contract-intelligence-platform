// ─── Contracts ────────────────────────────────────────────────────────────────

export type ContractStatus = "uploading" | "processing" | "ready" | "error";

export interface Contract {
  id: string;
  filename: string;
  file_url: string;
  file_size_bytes: number;
  page_count: number;
  chunk_count: number;
  status: ContractStatus;
  error_message: string | null;
  summary: string | null;
  pinecone_namespace: string;
  created_at: string;
  updated_at: string;
}

export interface UploadUrlRequest {
  filename: string;
  file_size_bytes: number;
}

export interface UploadUrlResponse {
  contract_id: string;
  upload_url: string;
}

// ─── Clauses ──────────────────────────────────────────────────────────────────

export type ClauseType =
  | "termination"
  | "liability"
  | "indemnification"
  | "confidentiality"
  | "payment_terms"
  | "governing_law"
  | "non_compete"
  | "intellectual_property"
  | "force_majeure"
  | "dispute_resolution"
  | "warranty"
  | "insurance"
  | "data_protection"
  | "other";

export interface Clause {
  id: string;
  contract_id: string;
  clause_type: ClauseType;
  title: string;
  content: string;
  page_number: number;
  confidence_score: number;
  created_at: string;
}

export interface ClausesGroupedResponse {
  clauses_by_type: Record<string, Clause[]>;
  total: number;
}

// ─── Risks ────────────────────────────────────────────────────────────────────

export type Severity = "low" | "medium" | "high" | "critical";

export interface Risk {
  id: string;
  contract_id: string;
  clause_id: string | null;
  risk_type: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  created_at: string;
}

export interface RisksResponse {
  risks: Risk[];
  severity_counts: Record<string, number>;
  total: number;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface SourceChunk {
  page: number;
  text: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  contract_id: string;
  role: "user" | "assistant";
  content: string;
  source_chunks: SourceChunk[] | null;
  created_at: string;
}

export interface ChatRequest {
  question: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
  message_id: string;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
}

// ─── API Wrappers ─────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
