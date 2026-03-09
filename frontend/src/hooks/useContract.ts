import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/client";
import type { ContractStatus } from "@/types";

// ─── Contracts ────────────────────────────────────────────────────────────────

export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: api.listContracts,
    // Poll while any contract is still processing
    refetchInterval: (query) => {
      const contracts = query.state.data;
      const hasProcessing = contracts?.some(
        (c) => c.status === "processing" || c.status === "uploading"
      );
      return hasProcessing ? 2000 : false;
    },
  });
}

export function useContract(contractId: string) {
  return useQuery({
    queryKey: ["contracts", contractId],
    queryFn: () => api.getContract(contractId),
    refetchInterval: (query) => {
      const status = query.state.data?.status as ContractStatus | undefined;
      return status === "processing" || status === "uploading" ? 2000 : false;
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export function useChatHistory(contractId: string) {
  return useQuery({
    queryKey: ["chat", contractId],
    queryFn: () => api.getChatHistory(contractId),
  });
}

export function useSendMessage(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (question: string) => api.sendChatMessage(contractId, { question }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", contractId] });
    },
  });
}

// ─── Clauses ──────────────────────────────────────────────────────────────────

export function useClauses(contractId: string) {
  return useQuery({
    queryKey: ["clauses", contractId],
    queryFn: () => api.getClauses(contractId),
    // Keep polling until clauses appear (extraction is a background task)
    refetchInterval: (query) => (query.state.data?.total ?? 0) === 0 ? 3000 : false,
  });
}

export function useExtractClauses(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.extractClauses(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clauses", contractId] });
    },
  });
}

// ─── Risks ────────────────────────────────────────────────────────────────────

export function useRisks(contractId: string) {
  return useQuery({
    queryKey: ["risks", contractId],
    queryFn: () => api.getRisks(contractId),
    // Keep polling until risks appear (analysis is a background task)
    refetchInterval: (query) => (query.state.data?.total ?? 0) === 0 ? 3000 : false,
  });
}

export function useAnalyzeRisks(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.analyzeRisks(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risks", contractId] });
    },
  });
}
