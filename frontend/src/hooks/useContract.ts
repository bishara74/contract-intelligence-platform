import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
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
  });
}

/**
 * Triggers clause extraction and tracks "extracting" state until clauses appear.
 * `isExtracting` stays true from the moment the user clicks until results arrive,
 * so the button remains disabled/loading throughout the background task.
 */
export function useExtractClauses(contractId: string) {
  const queryClient = useQueryClient();
  const [waitingForResults, setWaitingForResults] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const mutation = useMutation({
    mutationFn: () => api.extractClauses(contractId),
    onSuccess: () => {
      setWaitingForResults(true);
      // Poll for clauses every 3s until they appear
      stopPolling();
      pollRef.current = setInterval(async () => {
        const data = await queryClient.fetchQuery({
          queryKey: ["clauses", contractId],
          queryFn: () => api.getClauses(contractId),
        });
        if (data && data.total > 0) {
          setWaitingForResults(false);
          stopPolling();
          queryClient.invalidateQueries({ queryKey: ["clauses", contractId] });
        }
      }, 3000);
    },
  });

  return {
    ...mutation,
    isExtracting: mutation.isPending || waitingForResults,
  };
}

// ─── Risks ────────────────────────────────────────────────────────────────────

export function useRisks(contractId: string) {
  return useQuery({
    queryKey: ["risks", contractId],
    queryFn: () => api.getRisks(contractId),
  });
}

/**
 * Triggers risk analysis and tracks "analyzing" state until risks appear.
 */
export function useAnalyzeRisks(contractId: string) {
  const queryClient = useQueryClient();
  const [waitingForResults, setWaitingForResults] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const mutation = useMutation({
    mutationFn: () => api.analyzeRisks(contractId),
    onSuccess: () => {
      setWaitingForResults(true);
      stopPolling();
      pollRef.current = setInterval(async () => {
        const data = await queryClient.fetchQuery({
          queryKey: ["risks", contractId],
          queryFn: () => api.getRisks(contractId),
        });
        if (data && data.total > 0) {
          setWaitingForResults(false);
          stopPolling();
          queryClient.invalidateQueries({ queryKey: ["risks", contractId] });
        }
      }, 3000);
    },
  });

  return {
    ...mutation,
    isAnalyzing: mutation.isPending || waitingForResults,
  };
}
