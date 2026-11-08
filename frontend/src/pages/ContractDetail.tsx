import { AlertCircle, ArrowLeft, BookOpen, Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ChatWindow from "@/components/chat/ChatWindow";
import ClauseList from "@/components/clauses/ClauseList";
import RiskList from "@/components/risks/RiskList";
import RiskSummaryBar from "@/components/risks/RiskSummaryBar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isDemoId } from "@/demo/sampleContract";
import {
  useAnalyzeRisks,
  useClauses,
  useContract,
  useExtractClauses,
  useRisks,
} from "@/hooks/useContract";
import { formatBytes, formatDate } from "@/lib/utils";
import type { Clause } from "@/types";
import { useChatStore } from "@/store/chatStore";

// ── Sidebar ────────────────────────────────────────────────────────────────────

function SideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b py-5 first:pt-0 last:border-0">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function ContractSidebar({ contractId }: { contractId: string }) {
  const { data: contract } = useContract(contractId);
  const { data: clauses } = useClauses(contractId);
  const { data: risks } = useRisks(contractId);
  const { mutate: extractClauses, isExtracting } = useExtractClauses(contractId);
  const { mutate: analyzeRisks, isAnalyzing } = useAnalyzeRisks(contractId);
  const setActiveTab = useChatStore((s) => s.setActiveTab);

  if (!contract) return null;
  const clauseCount = clauses?.total ?? 0;
  const riskCount = risks?.total ?? 0;

  return (
    <aside className="h-full overflow-y-auto px-6 py-6">
      {contract.summary && (
        <SideSection title="Summary">
          <p className="font-serif text-[15px] leading-[1.65] text-ink/85">{contract.summary}</p>
        </SideSection>
      )}

      <SideSection title="Clauses">
        {clauseCount > 0 ? (
          <button
            onClick={() => setActiveTab("clauses")}
            className="text-left text-sm text-muted-foreground hover:text-ink"
          >
            <span className="text-2xl font-bold tabular-nums text-ink">{clauseCount}</span> extracted across{" "}
            {Object.keys(clauses?.clauses_by_type ?? {}).length} types
          </button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => extractClauses()} disabled={isExtracting}>
            {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            {isExtracting ? "Extracting clauses…" : "Extract clauses"}
          </Button>
        )}
      </SideSection>

      <SideSection title="Risks">
        {riskCount > 0 && risks ? (
          <button onClick={() => setActiveTab("risks")} className="block w-full text-left">
            <RiskSummaryBar severityCounts={risks.severity_counts} total={riskCount} compact />
          </button>
        ) : (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => analyzeRisks()}
              disabled={isAnalyzing || clauseCount === 0}
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              {isAnalyzing ? "Analyzing risks…" : "Analyze risks"}
            </Button>
            {clauseCount === 0 && <p className="text-xs text-muted-foreground">Extract clauses first.</p>}
          </div>
        )}
      </SideSection>

      <SideSection title="File">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Size</dt>
          <dd className="text-ink">{formatBytes(contract.file_size_bytes)}</dd>
          <dt className="text-muted-foreground">Passages</dt>
          <dd className="text-ink">{contract.chunk_count} indexed for search</dd>
          <dt className="text-muted-foreground">Added</dt>
          <dd className="text-ink">{formatDate(contract.created_at)}</dd>
        </dl>
      </SideSection>
    </aside>
  );
}

// ── Page states ───────────────────────────────────────────────────────────────

function CenterState({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">{children}</div>;
}

function BackLink() {
  return (
    <Link
      to="/dashboard"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      All contracts
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContractDetail({ contractId }: { contractId?: string }) {
  const params = useParams<{ id: string }>();
  const id = contractId ?? params.id;
  const { activeTab, setActiveTab } = useChatStore();
  const { data: contract, isLoading, error } = useContract(id ?? "");
  const { data: clauses } = useClauses(id ?? "");
  const { data: risks } = useRisks(id ?? "");
  const demo = isDemoId(id);

  if (!id) return <Navigate to="/dashboard" replace />;

  if (isLoading) {
    return (
      <CenterState>
        <Loader2 className="h-6 w-6 animate-spin text-ink" />
        <p className="text-sm text-muted-foreground">Opening contract…</p>
      </CenterState>
    );
  }

  if (error || !contract) {
    return (
      <CenterState>
        <AlertCircle className="h-7 w-7 text-redline" />
        <p className="font-semibold text-ink">This contract couldn’t be found.</p>
        <p className="text-sm text-muted-foreground">It may have been deleted, or the server is waking up.</p>
        <BackLink />
      </CenterState>
    );
  }

  if (contract.status !== "ready") {
    return (
      <CenterState>
        <Loader2 className="h-7 w-7 animate-spin text-ink" />
        <p className="font-semibold text-ink">Reading {contract.filename}…</p>
        <p className="text-sm text-muted-foreground">This usually takes 30 to 60 seconds.</p>
        <BackLink />
      </CenterState>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "chat" | "clauses" | "risks")}
      className="flex h-full min-h-0 flex-col"
    >
      {/* Document header */}
      <div className="flex-none border-b bg-card">
        <div className="mx-auto max-w-[1400px] px-5 pt-5">
          {!demo && (
            <div className="mb-3">
              <BackLink />
            </div>
          )}
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink" title={contract.filename}>
            {contract.filename.replace(/\.pdf$/i, "")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            PDF, {contract.page_count} pages, added {formatDate(contract.created_at)}
          </p>
          <TabsList className="mt-3" aria-label="Contract views">
            <TabsTrigger value="chat">Ask</TabsTrigger>
            <TabsTrigger value="clauses">
              Clauses
              {!!clauses?.total && <Count n={clauses.total} />}
            </TabsTrigger>
            <TabsTrigger value="risks">
              Risks
              {!!risks?.total && <Count n={risks.total} alert={(risks.severity_counts.critical ?? 0) > 0} />}
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 w-full flex-1">
        <div className="min-w-0 flex-1">
          <TabsContent value="chat" className="mt-0 h-full data-[state=inactive]:hidden">
            <ChatWindow contractId={id} />
          </TabsContent>
          <TabsContent value="clauses" className="mt-0 h-full overflow-y-auto px-5 py-6 data-[state=inactive]:hidden">
            <ClausesTab contractId={id} />
          </TabsContent>
          <TabsContent value="risks" className="mt-0 h-full overflow-y-auto px-5 py-6 data-[state=inactive]:hidden">
            <RisksTab contractId={id} />
          </TabsContent>
        </div>
        <div className="hidden w-[340px] flex-none border-l bg-card/60 lg:block">
          <ContractSidebar contractId={id} />
        </div>
      </div>
    </Tabs>
  );
}

function Count({ n, alert }: { n: number; alert?: boolean }) {
  return (
    <span
      className={
        alert
          ? "rounded-full bg-redline px-1.5 text-[11px] font-bold leading-[18px] text-white"
          : "rounded-full bg-muted px-1.5 text-[11px] font-bold leading-[18px] text-muted-foreground"
      }
    >
      {n}
    </span>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function Working({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center" role="status">
      <Loader2 className="h-7 w-7 animate-spin text-ink" />
      <p className="font-semibold text-ink">{label}</p>
      <p className="text-sm text-muted-foreground">This usually takes 30 to 60 seconds.</p>
    </div>
  );
}

function EmptyTab({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-20 text-center">
      <p className="text-lg font-bold text-ink">{title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

function ClausesTab({ contractId }: { contractId: string }) {
  const { data, isLoading } = useClauses(contractId);
  const { mutate: extract, isExtracting } = useExtractClauses(contractId);

  if (isLoading) return <Working label="Loading clauses…" />;
  if (isExtracting) return <Working label="Extracting clauses…" />;
  if (!data || data.total === 0) {
    return (
      <EmptyTab
        title="No clauses yet"
        description="Pull out termination, liability, payment, confidentiality and other key provisions, grouped by type."
        action={
          <Button onClick={() => extract()}>
            <BookOpen className="h-4 w-4" />
            Extract clauses
          </Button>
        }
      />
    );
  }
  return <ClauseList clausesByType={data.clauses_by_type} total={data.total} />;
}

function RisksTab({ contractId }: { contractId: string }) {
  const { data, isLoading } = useRisks(contractId);
  const { mutate: analyze, isAnalyzing } = useAnalyzeRisks(contractId);
  const { data: clauses } = useClauses(contractId);
  const hasClauses = (clauses?.total ?? 0) > 0;

  if (isLoading) return <Working label="Loading risks…" />;
  if (isAnalyzing) return <Working label="Analyzing risks…" />;
  if (!data || data.total === 0) {
    return (
      <EmptyTab
        title="No risks analyzed yet"
        description={
          hasClauses
            ? "Check the extracted clauses for auto-renewals, uncapped liability, one-sided terms and missing protections."
            : "Risk analysis works from the extracted clauses. Extract them first in the Clauses tab."
        }
        action={
          <Button onClick={() => analyze()} disabled={!hasClauses}>
            <ShieldAlert className="h-4 w-4" />
            Analyze risks
          </Button>
        }
      />
    );
  }
  const clauseIndex = Object.values(clauses?.clauses_by_type ?? {})
    .flat()
    .reduce<Record<string, Clause>>((acc, c) => ({ ...acc, [c.id]: c }), {});
  return <RiskList risks={data.risks} severityCounts={data.severity_counts} total={data.total} clauses={clauseIndex} />;
}
