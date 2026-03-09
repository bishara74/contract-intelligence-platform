import { ChevronDown, ChevronRight, Link2, Lightbulb } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Risk, Severity } from "@/types";

const SEVERITY_STYLES: Record<Severity, { badge: string; border: string; dot: string }> = {
  critical: {
    badge: "bg-red-600 text-white",
    border: "border-l-red-600",
    dot: "bg-red-600",
  },
  high: {
    badge: "bg-orange-500 text-white",
    border: "border-l-orange-500",
    dot: "bg-orange-500",
  },
  medium: {
    badge: "bg-yellow-500 text-white",
    border: "border-l-yellow-500",
    dot: "bg-yellow-500",
  },
  low: {
    badge: "bg-blue-500 text-white",
    border: "border-l-blue-500",
    dot: "bg-blue-500",
  },
};

interface RiskCardProps {
  risk: Risk;
}

export default function RiskCard({ risk }: RiskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const styles = SEVERITY_STYLES[risk.severity as Severity] ?? SEVERITY_STYLES.medium;

  return (
    <div className={cn("rounded-lg border-l-4 border border-l-4 bg-card overflow-hidden", styles.border)}>
      <button
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                styles.badge
              )}
            >
              {risk.severity}
            </span>
            <span className="text-sm font-semibold">{risk.title}</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{risk.description}</p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t bg-muted/20 space-y-3">
          <div className="pt-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</p>
            <p className="text-sm leading-relaxed">{risk.description}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Recommendation
            </p>
            <p className="text-sm leading-relaxed text-foreground">{risk.recommendation}</p>
          </div>

          {risk.clause_id && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link2 className="h-3 w-3" />
              Linked to clause
            </div>
          )}
        </div>
      )}
    </div>
  );
}
