import { useState } from "react";
import type { Clause, Risk, Severity } from "@/types";
import FilterChips from "@/components/ui/filter-chips";
import RiskCard from "./RiskCard";
import RiskSummaryBar from "./RiskSummaryBar";
import { SEVERITY, SEVERITY_ORDER } from "./severity";

interface RiskListProps {
  risks: Risk[];
  severityCounts: Record<string, number>;
  total: number;
  clauses?: Record<string, Clause>;
}

const rank = (s: string) => SEVERITY_ORDER.indexOf(s as Severity);

export default function RiskList({ risks, severityCounts, total, clauses = {} }: RiskListProps) {
  const [filter, setFilter] = useState("all");
  const sorted = [...risks].sort((a, b) => rank(a.severity) - rank(b.severity));
  const visible = filter === "all" ? sorted : sorted.filter((r) => r.severity === filter);

  const options = [
    { value: "all", label: "All", count: total },
    ...SEVERITY_ORDER.filter((s) => (severityCounts[s] ?? 0) > 0).map((s) => ({
      value: s,
      label: SEVERITY[s].label,
      count: severityCounts[s],
    })),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <RiskSummaryBar severityCounts={severityCounts} total={total} />
      <FilterChips label="Filter by severity" options={options} value={filter} onChange={setFilter} />
      <div className="space-y-3">
        {visible.map((risk) => (
          <RiskCard key={risk.id} risk={risk} clause={risk.clause_id ? clauses[risk.clause_id] : undefined} />
        ))}
      </div>
    </div>
  );
}
