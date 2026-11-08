import { useState } from "react";
import FilterChips from "@/components/ui/filter-chips";
import type { Clause, ClauseType } from "@/types";
import ClauseCard, { CLAUSE_LABELS } from "./ClauseCard";

interface ClauseListProps {
  clausesByType: Record<string, Clause[]>;
  total: number;
}

const label = (t: string) => CLAUSE_LABELS[t as ClauseType] ?? t;

export default function ClauseList({ clausesByType, total }: ClauseListProps) {
  // Largest groups first, "other" always last
  const types = Object.keys(clausesByType).sort((a, b) =>
    a === "other" ? 1 : b === "other" ? -1 : clausesByType[b].length - clausesByType[a].length
  );
  const [filter, setFilter] = useState("all");
  const visible = filter === "all" ? types : types.filter((t) => t === filter);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <FilterChips
        label="Filter by clause type"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: total },
          ...types.map((t) => ({ value: t, label: label(t), count: clausesByType[t].length })),
        ]}
      />
      {visible.map((type) => (
        <section key={type} className="space-y-3">
          <h2 className="flex items-baseline gap-2 text-lg font-bold text-ink">
            <span className="mark">{label(type)}</span>
            <span className="text-sm font-semibold text-muted-foreground">{clausesByType[type].length}</span>
          </h2>
          {clausesByType[type].map((c) => (
            <ClauseCard key={c.id} clause={c} />
          ))}
        </section>
      ))}
    </div>
  );
}
