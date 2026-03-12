import axios from "axios";
import type {
  ChatHistoryResponse,
  ChatRequest,
  ChatResponse,
  ClausesGroupedResponse,
  Contract,
  RisksResponse,
  UploadUrlRequest,
  UploadUrlResponse,
} from "@/types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// ─── Auth token injection ────────────────────────────────────────────────────

type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter | null = null;

export function setTokenGetter(getter: TokenGetter) {
  getToken = getter;
}

api.interceptors.request.use(async (config) => {
  if (getToken) {
    try {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error("Failed to get auth token:", e);
    }
  }
  return config;
});

// Unwrap the { success, data } envelope
api.interceptors.response.use((res) => {
  if (res.data && typeof res.data === "object" && "success" in res.data) {
    if (res.data.success) {
      res.data = res.data.data;
    } else {
      return Promise.reject(res.data.error);
    }
  }
  return res;
});

// ─── Contracts ────────────────────────────────────────────────────────────────

export async function getUploadUrl(req: UploadUrlRequest): Promise<UploadUrlResponse> {
  const res = await api.post<UploadUrlResponse>("/api/v1/contracts/upload-url", req);
  return res.data;
}

export async function confirmUpload(contractId: string): Promise<Contract> {
  const res = await api.post<Contract>(`/api/v1/contracts/${contractId}/confirm-upload`);
  return res.data;
}

export async function listContracts(): Promise<Contract[]> {
  const res = await api.get<Contract[]>("/api/v1/contracts");
  return res.data;
}

export async function getContract(contractId: string): Promise<Contract> {
  const res = await api.get<Contract>(`/api/v1/contracts/${contractId}`);
  return res.data;
}

export async function deleteContract(contractId: string): Promise<void> {
  await api.delete(`/api/v1/contracts/${contractId}`);
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function sendChatMessage(contractId: string, req: ChatRequest): Promise<ChatResponse> {
  const res = await api.post<ChatResponse>(`/api/v1/contracts/${contractId}/chat`, req);
  return res.data;
}

export async function getChatHistory(contractId: string): Promise<ChatHistoryResponse> {
  const res = await api.get<ChatHistoryResponse>(`/api/v1/contracts/${contractId}/chat/history`);
  return res.data;
}

// ─── Clauses ──────────────────────────────────────────────────────────────────

export async function extractClauses(contractId: string): Promise<{ status: string }> {
  const res = await api.post<{ status: string }>(`/api/v1/contracts/${contractId}/extract-clauses`);
  return res.data;
}

export async function getClauses(contractId: string): Promise<ClausesGroupedResponse> {
  const res = await api.get<ClausesGroupedResponse>(`/api/v1/contracts/${contractId}/clauses`);
  return res.data;
}

// ─── Risks ────────────────────────────────────────────────────────────────────

export async function analyzeRisks(contractId: string): Promise<{ status: string }> {
  const res = await api.post<{ status: string }>(`/api/v1/contracts/${contractId}/analyze-risks`);
  return res.data;
}

export async function getRisks(contractId: string): Promise<RisksResponse> {
  const res = await api.get<RisksResponse>(`/api/v1/contracts/${contractId}/risks`);
  return res.data;
}

export default api;
