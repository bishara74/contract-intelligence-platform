import { cn } from "@/lib/utils";
import { SEVERITY, SEVERITY_ORDER } from "./severity";

interface RiskSummaryBarProps {
  severityCounts: Record<string, number>;
  total: number;
  compact?: boolean;
}

/** Proportional bar of risks by severity, with a count legend. */
export default function RiskSummaryBar({ severityCounts, total, compact }: RiskSummaryBarProps) {
  const present = SEVERITY_ORDER.filter((s) => (severityCounts[s] ?? 0) > 0);
  return (
    <div className={cn("space-y-3", !compact && "sheet rounded-md p-5")}>
      <p className={cn("text-muted-foreground", compact ? "text-sm" : "text-[15px]")}>
        <span className={cn("font-bold tabular-nums text-ink", compact ? "text-2xl" : "text-3xl")}>{total}</span>{" "}
        {total === 1 ? "risk" : "risks"} found
      </p>
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={present.map((s) => `${severityCounts[s]} ${s}`).join(", ")}
      >
        {present.map((s) => (
          <div key={s} className={SEVERITY[s].bar} style={{ flex: severityCounts[s] }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {SEVERITY_ORDER.map((s) => {
          const n = severityCounts[s] ?? 0;
          return (
            <li key={s} className={cn("flex items-center gap-1.5", n === 0 && "opacity-45")}>
              <span className={cn("h-2 w-2 rounded-full", SEVERITY[s].bar)} aria-hidden />
              <span className="font-semibold tabular-nums text-ink">{n}</span>
              <span className="text-muted-foreground">{SEVERITY[s].label.toLowerCase()}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
