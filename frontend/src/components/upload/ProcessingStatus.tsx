import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { ContractStatus } from "@/types";

interface ProcessingStatusProps {
  status: ContractStatus;
  filename: string;
  errorMessage?: string | null;
}

const STEPS = [
  { label: "Uploading to secure storage", statuses: ["uploading"] },
  { label: "Parsing PDF & extracting text", statuses: ["processing"] },
  { label: "Embedding into vector database", statuses: ["processing"] },
  { label: "Ready for analysis", statuses: ["ready"] },
];

function getProgress(status: ContractStatus): number {
  if (status === "uploading") return 20;
  if (status === "processing") return 65;
  if (status === "ready") return 100;
  return 0;
}

export default function ProcessingStatus({ status, filename, errorMessage }: ProcessingStatusProps) {
  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-medium">Processing failed</p>
          <p className="text-sm text-muted-foreground mt-1">{errorMessage ?? "An unexpected error occurred."}</p>
        </div>
      </div>
    );
  }

  const progress = getProgress(status);

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-3">
        {status === "ready" ? (
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
        ) : (
          <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{filename}</p>
          <p className="text-xs text-muted-foreground">
            {status === "ready" ? "Processing complete" : "Processing your contract…"}
          </p>
        </div>
      </div>

      <Progress value={progress} className="h-1.5" />

      <div className="space-y-1.5">
        {STEPS.map((step, i) => {
          return (
            <div key={step.label} className="flex items-center gap-2 text-xs">
              {i === 0 && (status === "uploading" || status === "processing" || status === "ready") ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              ) : status === "ready" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              ) : status === "processing" && i <= 2 ? (
                i < 2 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin flex-shrink-0" />
                )
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 flex-shrink-0" />
              )}
              <span
                className={
                  status === "ready" || (status === "processing" && i < 2)
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
