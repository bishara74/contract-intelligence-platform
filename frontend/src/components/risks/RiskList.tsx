import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Risk, Severity } from "@/types";
import RiskCard from "./RiskCard";
import RiskSummaryBar from "./RiskSummaryBar";

const ALL = "all";
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

interface RiskListProps {
  risks: Risk[];
  severityCounts: Record<string, number>;
  total: number;
}

export default function RiskList({ risks, severityCounts, total }: RiskListProps) {
  const [filter, setFilter] = useState<string>(ALL);

  const visible = filter === ALL ? risks : risks.filter((r) => r.severity === filter);

  return (
    <div className="space-y-4">
      <RiskSummaryBar severityCounts={severityCounts} total={total} />

      {/* Severity filter */}
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
          All ({total})
        </button>
        {SEVERITIES.map((sev) => {
          const count = severityCounts[sev] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-colors",
                filter === sev
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:border-primary/50"
              )}
            >
              {sev} ({count})
            </button>
          );
        })}
      </div>

      {/* Risk cards */}
      <div className="space-y-3">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No {filter !== ALL ? filter : ""} risks found.
          </p>
        ) : (
          visible.map((risk) => <RiskCard key={risk.id} risk={risk} />)
        )}
      </div>
    </div>
  );
}
