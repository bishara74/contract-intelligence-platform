import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Clause, Risk, Severity } from "@/types";
import { SEVERITY } from "./severity";

interface RiskCardProps {
  risk: Risk;
  clause?: Clause;
}

export default function RiskCard({ risk, clause }: RiskCardProps) {
  const [open, setOpen] = useState(false);
  const sev = SEVERITY[risk.severity as Severity] ?? SEVERITY.medium;

  return (
    <article className={cn("sheet overflow-hidden rounded-md border-l-4", sev.rule)}>
      <button
        className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-muted/50"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-bold", sev.text)}>{sev.label} risk</p>
          <h3 className="mt-0.5 font-bold text-ink">{risk.title}</h3>
          <p className={cn("mt-1 text-sm leading-relaxed text-muted-foreground", !open && "line-clamp-2")}>
            {risk.description}
          </p>
        </div>
        <ChevronDown
          className={cn("mt-1 h-4 w-4 flex-none text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="space-y-4 px-5 pb-5">
          <div className="rounded-sm bg-highlight/35 px-4 py-3">
            <p className="text-xs font-bold text-ink">Suggested fix</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{risk.recommendation}</p>
          </div>
          {clause && (
            <figure className="border-l-2 pl-4">
              <figcaption className="text-xs font-semibold text-muted-foreground">
                {clause.title}, page {clause.page_number}
              </figcaption>
              <blockquote className="mt-1 font-serif text-[15px] leading-[1.65] text-ink/85">
                {clause.content}
              </blockquote>
            </figure>
          )}
        </div>
      )}
    </article>
  );
}
