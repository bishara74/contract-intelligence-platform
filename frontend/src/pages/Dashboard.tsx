import {
  AlertCircle,
  FileText,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DropZone from "@/components/upload/DropZone";
import ProcessingStatus from "@/components/upload/ProcessingStatus";
import { useContract, useContracts, useDeleteContract } from "@/hooks/useContract";
import { cn, formatDate } from "@/lib/utils";
import type { Contract, ContractStatus } from "@/types";

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContractStatus }) {
  const map: Record<ContractStatus, { label: string; variant: "warning" | "success" | "error" | "secondary" }> = {
    uploading: { label: "Uploading", variant: "warning" },
    processing: { label: "Processing", variant: "warning" },
    ready: { label: "Ready", variant: "success" },
    error: { label: "Error", variant: "error" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

// ── Contract card ─────────────────────────────────────────────────────────────

function ContractCard({
  contract,
  onDelete,
}: {
  contract: Contract;
  onDelete: (c: Contract) => void;
}) {
  const navigate = useNavigate();
  const isReady = contract.status === "ready";

  return (
    <Card
      className={cn(
        "flex flex-col transition-shadow",
        isReady && "hover:shadow-md cursor-pointer"
      )}
      onClick={() => isReady && navigate(`/contracts/${contract.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
            <CardTitle className="text-base truncate">{contract.filename}</CardTitle>
          </div>
          <StatusBadge status={contract.status} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        {contract.status === "processing" || contract.status === "uploading" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Processing…
          </div>
        ) : contract.status === "error" ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {contract.error_message ?? "Processing failed"}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{contract.page_count} pages · {contract.chunk_count} chunks</p>
            {contract.summary && (
              <p className="line-clamp-2 text-xs">{contract.summary}</p>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{formatDate(contract.created_at)}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(contract);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

// ── Upload modal ──────────────────────────────────────────────────────────────

type UploadState =
  | { phase: "idle" }
  | { phase: "selected"; file: File }
  | { phase: "uploading" }
  | { phase: "processing"; contractId: string }
  | { phase: "error"; message: string };

function UploadModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [uploadState, setUploadState] = useState<UploadState>({ phase: "idle" });
  const { data: processingContract } = useContract(
    uploadState.phase === "processing" ? uploadState.contractId : ""
  );

  const handleFileSelected = (file: File) => {
    setUploadState({ phase: "selected", file });
  };

  const handleUpload = async () => {
    if (uploadState.phase !== "selected") return;
    const { file } = uploadState;

    try {
      setUploadState({ phase: "uploading" });

      // 1. Get presigned URL + contract record
      const { contract_id, upload_url } = await api.getUploadUrl({
        filename: file.name,
        file_size_bytes: file.size,
      });

      // 2. PUT directly to R2
      const putRes = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.statusText}`);

      // 3. Confirm upload → triggers processing pipeline
      await api.confirmUpload(contract_id);

      setUploadState({ phase: "processing", contractId: contract_id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadState({ phase: "error", message: msg });
    }
  };

  const handleClose = () => {
    setUploadState({ phase: "idle" });
    onClose();
  };

  const isProcessingDone = processingContract?.status === "ready" || processingContract?.status === "error";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Contract</DialogTitle>
          <DialogDescription>
            Upload a PDF contract for AI-powered analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {uploadState.phase === "idle" || uploadState.phase === "selected" ? (
            <DropZone
              onFileSelected={handleFileSelected}
              disabled={false}
              error={null}
            />
          ) : uploadState.phase === "uploading" ? (
            <div className="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Uploading to secure storage…
            </div>
          ) : uploadState.phase === "processing" && processingContract ? (
            <ProcessingStatus
              status={processingContract.status}
              filename={processingContract.filename}
              errorMessage={processingContract.error_message}
            />
          ) : uploadState.phase === "error" ? (
            <div className="flex items-center gap-2 text-sm text-destructive py-4">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {uploadState.message}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {(uploadState.phase === "idle" || uploadState.phase === "selected" || uploadState.phase === "error") && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              {uploadState.phase === "selected" && (
                <Button onClick={handleUpload}>
                  <UploadCloud className="h-4 w-4" />
                  Upload
                </Button>
              )}
              {uploadState.phase === "error" && (
                <Button variant="outline" onClick={() => setUploadState({ phase: "idle" })}>
                  Try Again
                </Button>
              )}
            </>
          )}
          {uploadState.phase === "processing" && isProcessingDone && (
            <Button onClick={handleClose}>
              {processingContract?.status === "ready" ? "View Contract" : "Close"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirm dialog ──────────────────────────────────────────────────────

function DeleteDialog({
  contract,
  onClose,
}: {
  contract: Contract | null;
  onClose: () => void;
}) {
  const { mutate: deleteContract, isPending } = useDeleteContract();

  const handleConfirm = () => {
    if (!contract) return;
    deleteContract(contract.id, { onSuccess: onClose });
  };

  return (
    <Dialog open={!!contract} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Contract</DialogTitle>
          <DialogDescription>
            This will permanently delete <span className="font-medium">{contract?.filename}</span> and all
            its clauses, risks, and chat history. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: contracts = [], isLoading, error } = useContracts();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Contracts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {contracts.length > 0
              ? `${contracts.length} contract${contracts.length !== 1 ? "s" : ""}`
              : "No contracts yet"}
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4" />
          Upload Contract
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading contracts…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-destructive py-8">
          <AlertCircle className="h-5 w-5" />
          Failed to load contracts. Is the backend running?
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && contracts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">No contracts yet</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs">
            Upload your first contract to get AI-powered clause extraction, risk analysis, and Q&A.
          </p>
          <Button onClick={() => setUploadOpen(true)}>
            <UploadCloud className="h-4 w-4" />
            Upload Your First Contract
          </Button>
        </div>
      )}

      {/* Contract grid */}
      {contracts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              onDelete={setContractToDelete}
            />
          ))}
        </div>
      )}

      <UploadModal open={uploadOpen} onClose={() => { setUploadOpen(false); }} />
      <DeleteDialog contract={contractToDelete} onClose={() => setContractToDelete(null)} />
    </div>
  );
}
