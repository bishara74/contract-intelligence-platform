import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SourceChunk } from "@/types";

/** One chip per page; the popover shows every retrieved passage from that page. */
export default function SourceCitation({ page, chunks }: { page: number; chunks: SourceChunk[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="rounded-sm border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:border-ink/40 hover:text-ink data-[state=open]:border-ink data-[state=open]:text-ink"
          aria-label={`Show source passages from page ${page}`}
        >
          p. {page}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] max-w-[90vw] p-0" side="top" align="start">
        <p className="border-b px-4 py-2.5 text-xs font-bold text-ink">
          Page {page}
          {chunks.length > 1 && <span className="font-semibold text-muted-foreground">, {chunks.length} passages</span>}
        </p>
        <div className="max-h-72 space-y-3 overflow-y-auto px-4 py-3">
          {chunks.map((c, i) => (
            <div key={i} className="space-y-1">
              <p className="font-serif text-sm leading-relaxed text-ink">{c.text}</p>
              {c.score > 0 && (
                <p className="text-xs text-muted-foreground">{Math.round(c.score * 100)}% match</p>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
