import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Clause, ClauseType } from "@/types";
import ClauseCard, { CLAUSE_LABELS } from "./ClauseCard";

const ALL = "all";

interface ClauseListProps {
  clausesByType: Record<string, Clause[]>;
  total: number;
}

function GroupSection({ type, clauses }: { type: string; clauses: Clause[] }) {
  const [open, setOpen] = useState(true);
  const label = CLAUSE_LABELS[type as ClauseType] ?? type;

  return (
    <div className="space-y-2">
      <button
        className="flex w-full items-center gap-2 py-1 text-left group"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold">{label}</span>
        <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {clauses.length}
        </span>
      </button>
      {open && (
        <div className="ml-6 space-y-2">
          {clauses.map((c) => <ClauseCard key={c.id} clause={c} />)}
        </div>
      )}
    </div>
  );
}

export default function ClauseList({ clausesByType, total }: ClauseListProps) {
  const types = Object.keys(clausesByType);
  const [filter, setFilter] = useState<string>(ALL);

  const visibleTypes = filter === ALL ? types : types.filter((t) => t === filter);

  return (
    <div className="space-y-4">
      {/* Header + filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{total} clause{total !== 1 ? "s" : ""} extracted</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter(ALL)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              filter === ALL
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground hover:border-primary/50"
            )}
          >
            All
          </button>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                filter === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:border-primary/50"
              )}
            >
              {CLAUSE_LABELS[t as ClauseType] ?? t} ({clausesByType[t].length})
            </button>
          ))}
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-5">
        {visibleTypes.map((type) => (
          <GroupSection key={type} type={type} clauses={clausesByType[type]} />
        ))}
      </div>
    </div>
  );
}
