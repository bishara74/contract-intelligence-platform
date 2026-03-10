import React from "react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  FileText,
  Hash,
  Layers,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatWindow from "@/components/chat/ChatWindow";
import ClauseList from "@/components/clauses/ClauseList";
import RiskList from "@/components/risks/RiskList";
import {
  useAnalyzeRisks,
  useContract,
  useClauses,
  useExtractClauses,
  useRisks,
} from "@/hooks/useContract";
import { useChatStore } from "@/store/chatStore";
import { formatDate } from "@/lib/utils";

// ── Sidebar ────────────────────────────────────────────────────────────────────

function ContractSidebar({ contractId }: { contractId: string }) {
  const { data: contract } = useContract(contractId);
  const { data: clauses } = useClauses(contractId);
  const { data: risks } = useRisks(contractId);
  const { mutate: extractClauses, isPending: extracting } = useExtractClauses(contractId);
  const { mutate: analyzeRisks, isPending: analyzing } = useAnalyzeRisks(contractId);

  if (!contract) return null;

  const clauseCount = clauses?.total ?? 0;
  const riskCount = risks?.total ?? 0;
  const criticalCount = risks?.severity_counts?.critical ?? 0;
  const highCount = risks?.severity_counts?.high ?? 0;

  return (
    <aside className="flex flex-col gap-5 h-full overflow-y-auto p-4">
      {/* Metadata */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Contract Info
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate font-medium text-foreground">{contract.filename}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{contract.page_count} pages · {contract.chunk_count} chunks</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Hash className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-mono text-xs truncate">{contract.id.slice(0, 8)}…</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{formatDate(contract.created_at)}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* AI Summary */}
      {contract.summary && (
        <>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              AI Summary
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{contract.summary}</p>
          </div>
          <Separator />
        </>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Analysis
        </h3>

        {/* Extract Clauses */}
        <div className="space-y-1.5">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => extractClauses()}
            disabled={extracting}
          >
            {extracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
            {extracting ? "Extracting…" : "Extract Clauses"}
          </Button>
          {clauseCount > 0 && (
            <p className="text-xs text-muted-foreground pl-1">
              {clauseCount} clause{clauseCount !== 1 ? "s" : ""} extracted
            </p>
          )}
        </div>

        {/* Analyze Risks */}
        <div className="space-y-1.5">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => analyzeRisks()}
            disabled={analyzing || clauseCount === 0}
            title={clauseCount === 0 ? "Extract clauses first" : undefined}
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            {analyzing ? "Analyzing…" : "Analyze Risks"}
          </Button>
          {riskCount > 0 && (
            <div className="flex items-center gap-1.5 pl-1">
              <p className="text-xs text-muted-foreground">{riskCount} risks found</p>
              {criticalCount > 0 && (
                <Badge variant="critical" className="text-[10px] px-1.5 py-0">
                  {criticalCount} critical
                </Badge>
              )}
              {highCount > 0 && !criticalCount && (
                <Badge variant="high" className="text-[10px] px-1.5 py-0">
                  {highCount} high
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveTab, activeTab } = useChatStore();
  const { data: contract, isLoading, error } = useContract(id ?? "");

  if (!id) {
    navigate("/dashboard");
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading contract…
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] gap-3 text-center px-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium">Contract not found</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (contract.status !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] gap-3 text-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-medium">Contract is {contract.status}…</p>
        <p className="text-sm text-muted-foreground">This usually takes 30-60 seconds.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* ── Tabs shell (Chat | Clauses | Risks) ── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "chat" | "clauses" | "risks")}
        className="flex flex-col flex-1 min-w-0"
      >
        {/* Tab bar + back button */}
        <div className="flex items-center gap-3 border-b px-4 py-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground h-8 px-2"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <TabsList className="h-8">
            <TabsTrigger value="chat" className="h-6 text-xs px-3">Chat</TabsTrigger>
            <TabsTrigger value="clauses" className="h-6 text-xs px-3">Clauses</TabsTrigger>
            <TabsTrigger value="risks" className="h-6 text-xs px-3">Risks</TabsTrigger>
          </TabsList>
          <span className="text-sm text-muted-foreground truncate hidden md:block ml-auto">
            {contract.filename}
          </span>
        </div>

        {/* Tab content area */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel: tab content */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <TabsContent value="chat" className="h-full mt-0">
              <ChatWindow contractId={id} />
            </TabsContent>
            <TabsContent value="clauses" className="h-full mt-0 overflow-y-auto p-4">
              <ClausesTab contractId={id} />
            </TabsContent>
            <TabsContent value="risks" className="h-full mt-0 overflow-y-auto p-4">
              <RisksTab contractId={id} />
            </TabsContent>
          </div>

          {/* Right sidebar */}
          <div className="w-72 flex-shrink-0 border-l hidden lg:block">
            <ContractSidebar contractId={id} />
          </div>
        </div>
      </Tabs>
    </div>
  );
}

// ── Step 11 placeholders ──────────────────────────────────────────────────────

function ClausesTab({ contractId }: { contractId: string }) {
  const { data, isLoading } = useClauses(contractId);
  const { mutate: extract, isPending } = useExtractClauses(contractId);

  if (isLoading) return <LoadingSpinner />;

  if (!data || data.total === 0) {
    return (
      <EmptyTabState
        icon={<BookOpen className="h-8 w-8 text-muted-foreground/40" />}
        title="No clauses extracted yet"
        description="Extract clauses to see termination, liability, payment, and other key provisions."
        action={
          <Button size="sm" onClick={() => extract()} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            Extract Clauses
          </Button>
        }
      />
    );
  }

  return (
    <ClauseList
      clausesByType={data.clauses_by_type}
      total={data.total}
    />
  );
}

function RisksTab({ contractId }: { contractId: string }) {
  const { data, isLoading } = useRisks(contractId);
  const { mutate: analyze, isPending } = useAnalyzeRisks(contractId);
  const { data: clauses } = useClauses(contractId);

  if (isLoading) return <LoadingSpinner />;

  if (!data || data.total === 0) {
    return (
      <EmptyTabState
        icon={<ShieldAlert className="h-8 w-8 text-muted-foreground/40" />}
        title="No risks analyzed yet"
        description="Analyze risks to flag auto-renewal traps, uncapped liability, missing clauses, and more."
        action={
          <Button
            size="sm"
            onClick={() => analyze()}
            disabled={isPending || !clauses?.total}
            title={!clauses?.total ? "Extract clauses first" : undefined}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            Analyze Risks
          </Button>
        }
      />
    );
  }

  return (
    <RiskList
      risks={data.risks}
      severityCounts={data.severity_counts}
      total={data.total}
    />
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading…
    </div>
  );
}

function EmptyTabState({
  icon, title, description, action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {icon}
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{description}</p>
      </div>
      {action}
    </div>
  );
}
