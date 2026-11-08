import { cn } from "@/lib/utils";

interface FilterChipsProps {
  label: string;
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
}

export default function FilterChips({ label, options, value, onChange }: FilterChipsProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors",
              active
                ? "border-ink bg-ink text-white"
                : "border-input bg-card text-muted-foreground hover:border-ink/40 hover:text-ink"
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("ml-1.5 tabular-nums", active ? "text-white/70" : "text-muted-foreground/70")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
