import { AlertCircle, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "@/api/client";
import { Button } from "@/components/ui/button";
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
import { formatDate } from "@/lib/utils";
import type { Contract } from "@/types";

// ── Contract row ──────────────────────────────────────────────────────────────

function Status({ contract }: { contract: Contract }) {
  if (contract.status === "ready") return <span className="text-sm text-muted-foreground">{contract.page_count} pages</span>;
  if (contract.status === "error")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-redline" title={contract.error_message ?? undefined}>
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        Couldn’t be read
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      Reading…
    </span>
  );
}

function ContractRow({ contract, onDelete }: { contract: Contract; onDelete: (c: Contract) => void }) {
  const ready = contract.status === "ready";
  const name = contract.filename.replace(/\.pdf$/i, "");
  return (
    <li className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 px-5 py-4 hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_9rem_8rem_auto]">
      <div className="min-w-0">
        {ready ? (
          <Link to={`/contracts/${contract.id}`} className="block truncate font-bold text-ink hover:underline underline-offset-2">
            {name}
          </Link>
        ) : (
          <span className="block truncate font-bold text-ink/70">{name}</span>
        )}
        {contract.summary && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{contract.summary}</p>}
      </div>
      <div className="hidden sm:block">
        <Status contract={contract} />
      </div>
      <span className="hidden text-sm text-muted-foreground sm:block">{formatDate(contract.created_at)}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:bg-redline/10 hover:text-redline"
        onClick={() => onDelete(contract)}
        aria-label={`Delete ${contract.filename}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <div className="col-span-2 flex gap-3 text-sm sm:hidden">
        <Status contract={contract} />
        <span className="text-muted-foreground">{formatDate(contract.created_at)}</span>
      </div>
    </li>
  );
}

// ── Upload modal ──────────────────────────────────────────────────────────────

type UploadState =
  | { phase: "idle" }
  | { phase: "selected"; file: File }
  | { phase: "uploading" }
  | { phase: "processing"; contractId: string }
  | { phase: "error"; message: string }
  | { phase: "duplicate"; message: string };

function UploadModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
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
      // Check for 409 duplicate — show as a friendly warning, not an error
      const axiosErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      if (axiosErr?.response?.status === 409) {
        const msg = "A contract with this file name is already uploaded. Rename the file or delete the existing contract, then upload again.";
        setUploadState({ phase: "duplicate", message: msg });
        return;
      }

      let msg = "Upload failed";
      if (axiosErr?.response?.data?.error?.message) {
        msg = axiosErr.response.data.error.message;
      } else if (err instanceof Error) {
        msg = err.message;
      }
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
          <DialogTitle>Upload a contract</DialogTitle>
          <DialogDescription>
            PDF only, up to 50 MB. Reading it usually takes under a minute.
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
              Uploading your contract…
            </div>
          ) : uploadState.phase === "processing" && processingContract ? (
            <ProcessingStatus
              status={processingContract.status}
              filename={processingContract.filename}
              errorMessage={processingContract.error_message}
            />
          ) : uploadState.phase === "duplicate" ? (
            <div className="flex items-start gap-2 rounded-md bg-highlight/40 p-3 text-sm text-ink">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {uploadState.message}
            </div>
          ) : uploadState.phase === "error" ? (
            <div className="flex items-center gap-2 text-sm text-destructive py-4">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {uploadState.message}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {(uploadState.phase === "idle" || uploadState.phase === "selected" || uploadState.phase === "error" || uploadState.phase === "duplicate") && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              {uploadState.phase === "selected" && (
                <Button onClick={handleUpload}>
                  <UploadCloud className="h-4 w-4" />
                  Upload contract
                </Button>
              )}
              {(uploadState.phase === "error" || uploadState.phase === "duplicate") && (
                <Button variant="outline" onClick={() => setUploadState({ phase: "idle" })}>
                  Try again
                </Button>
              )}
            </>
          )}
          {uploadState.phase === "processing" && isProcessingDone && (
            <Button
              onClick={() => {
                const ready = processingContract?.status === "ready";
                const id = uploadState.phase === "processing" ? uploadState.contractId : null;
                handleClose();
                if (ready && id) navigate(`/contracts/${id}`);
              }}
            >
              {processingContract?.status === "ready" ? "Open contract" : "Close"}
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
          <DialogTitle>Delete this contract?</DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-ink">{contract?.filename}</span> and its clauses, risks and
            questions will be permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: contracts = [], isLoading, error, refetch, isRefetching } = useContracts();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Your contracts</h1>
          {contracts.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {contracts.length} {contracts.length === 1 ? "contract" : "contracts"}
            </p>
          )}
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4" />
          Upload contract
        </Button>
      </div>

      {isLoading && (
        <div className="sheet flex items-center gap-3 rounded-md px-5 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your contracts. If the server was asleep, this can take up to a minute.
        </div>
      )}

      {error && !isLoading && (
        <div className="sheet rounded-md border-l-4 border-l-redline px-5 py-5" role="alert">
          <p className="font-bold text-ink">Couldn’t reach the server</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The API sleeps when idle and takes about a minute to wake up. Try again shortly, or{" "}
            <Link to="/demo" className="font-semibold text-ink underline underline-offset-2">open the sample NDA</Link>{" "}
            in the meantime.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching && <Loader2 className="h-4 w-4 animate-spin" />}
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !error && contracts.length === 0 && (
        <div className="sheet rounded-md px-6 py-14 text-center">
          <UploadCloud className="mx-auto h-9 w-9 text-ink" aria-hidden />
          <h2 className="mt-4 text-xl font-bold text-ink">Upload your first contract</h2>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            Add a PDF to ask questions about it, extract its clauses and check it for risky terms.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => setUploadOpen(true)}>
              <UploadCloud className="h-4 w-4" />
              Upload contract
            </Button>
            <Button variant="outline" asChild>
              <Link to="/demo">Open the sample NDA</Link>
            </Button>
          </div>
        </div>
      )}

      {contracts.length > 0 && (
        <div className="sheet overflow-hidden rounded-md">
          <div className="hidden grid-cols-[minmax(0,1fr)_9rem_8rem_2rem] gap-x-6 border-b bg-muted/50 px-5 py-2 text-xs font-semibold text-muted-foreground sm:grid">
            <span>Name</span>
            <span>Status</span>
            <span>Added</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul className="divide-y">
            {contracts.map((c) => (
              <ContractRow key={c.id} contract={c} onDelete={setContractToDelete} />
            ))}
          </ul>
        </div>
      )}

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <DeleteDialog contract={contractToDelete} onClose={() => setContractToDelete(null)} />
    </div>
  );
}
