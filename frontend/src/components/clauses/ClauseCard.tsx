import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Clause, ClauseType } from "@/types";

export const CLAUSE_LABELS: Record<ClauseType, string> = {
  termination: "Termination",
  liability: "Liability",
  indemnification: "Indemnification",
  confidentiality: "Confidentiality",
  payment_terms: "Payment terms",
  governing_law: "Governing law",
  non_compete: "Non-compete and non-solicitation",
  intellectual_property: "Intellectual property",
  force_majeure: "Force majeure",
  dispute_resolution: "Dispute resolution",
  warranty: "Warranty",
  insurance: "Insurance",
  data_protection: "Data protection",
  other: "Other",
};

const LONG = 300;

export default function ClauseCard({ clause }: { clause: Clause }) {
  const [open, setOpen] = useState(false);
  const long = clause.content.length > LONG;
  const pct = Math.round(clause.confidence_score * 100);

  return (
    <article className="sheet rounded-md px-5 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-bold text-ink">{clause.title}</h3>
        <span className="flex-none text-xs font-semibold text-muted-foreground">Page {clause.page_number}</span>
      </div>
      <p
        className={cn(
          "mt-2 font-serif text-[15px] leading-[1.65] text-ink/85",
          long && !open && "line-clamp-3"
        )}
      >
        {clause.content}
      </p>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span title="How confident the model is that this text is this clause type">
          <span className={cn("font-semibold", pct < 75 ? "text-severity-high" : "text-ink")}>{pct}%</span>{" "}
          confidence
        </span>
        {long && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="font-semibold text-ink underline-offset-2 hover:underline"
            aria-expanded={open}
          >
            {open ? "Show less" : "Show full clause"}
          </button>
        )}
      </div>
    </article>
  );
}
