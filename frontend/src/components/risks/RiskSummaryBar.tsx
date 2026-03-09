import type { Severity } from "@/types";

const SEVERITY_CONFIG: Record<Severity, { label: string; bg: string; text: string; border: string }> = {
  critical: { label: "Critical", bg: "bg-red-600", text: "text-white", border: "border-red-600" },
  high:     { label: "High",     bg: "bg-orange-500", text: "text-white", border: "border-orange-500" },
  medium:   { label: "Medium",   bg: "bg-yellow-500", text: "text-white", border: "border-yellow-500" },
  low:      { label: "Low",      bg: "bg-blue-500",   text: "text-white", border: "border-blue-500" },
};

const ORDER: Severity[] = ["critical", "high", "medium", "low"];

interface RiskSummaryBarProps {
  severityCounts: Record<string, number>;
  total: number;
}

export default function RiskSummaryBar({ severityCounts, total }: RiskSummaryBarProps) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Risk Summary</p>
        <span className="text-sm text-muted-foreground">{total} total</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {ORDER.map((sev) => {
          const count = severityCounts[sev] ?? 0;
          const cfg = SEVERITY_CONFIG[sev];
          return (
            <div
              key={sev}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
                count > 0 ? cfg.border : "border-muted"
              }`}
            >
              <div className={`h-2.5 w-2.5 rounded-full ${count > 0 ? cfg.bg : "bg-muted"}`} />
              <span className={`text-sm font-medium ${count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                {count}
              </span>
              <span className="text-xs text-muted-foreground">{cfg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
