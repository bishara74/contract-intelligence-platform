import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Clause, ClauseType } from "@/types";

const CLAUSE_LABELS: Record<ClauseType, string> = {
  termination: "Termination",
  liability: "Liability",
  indemnification: "Indemnification",
  confidentiality: "Confidentiality",
  payment_terms: "Payment Terms",
  governing_law: "Governing Law",
  non_compete: "Non-Compete",
  intellectual_property: "Intellectual Property",
  force_majeure: "Force Majeure",
  dispute_resolution: "Dispute Resolution",
  warranty: "Warranty",
  insurance: "Insurance",
  data_protection: "Data Protection",
  other: "Other",
};

const CLAUSE_COLORS: Record<ClauseType, string> = {
  termination: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  liability: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  indemnification: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  confidentiality: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  payment_terms: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  governing_law: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  non_compete: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  intellectual_property: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  force_majeure: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  dispute_resolution: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  warranty: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  insurance: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
  data_protection: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

interface ClauseCardProps {
  clause: Clause;
}

export default function ClauseCard({ clause }: ClauseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const label = CLAUSE_LABELS[clause.clause_type] ?? clause.clause_type;
  const colorClass = CLAUSE_COLORS[clause.clause_type] ?? CLAUSE_COLORS.other;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", colorClass)}>
              {label}
            </span>
            <span className="text-sm font-medium truncate">{clause.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              Page {clause.page_number}
            </div>
            <ConfidenceBar score={clause.confidence_score} />
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t bg-muted/20">
          <p className="text-sm leading-relaxed text-foreground pt-3 whitespace-pre-wrap">
            {clause.content}
          </p>
        </div>
      )}
    </div>
  );
}

export { CLAUSE_LABELS, CLAUSE_COLORS };
