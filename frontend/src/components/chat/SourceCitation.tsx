import { FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SourceChunk } from "@/types";

interface SourceCitationProps {
  source: SourceChunk;
  index: number;
}

export default function SourceCitation({ source, index }: SourceCitationProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
          <FileText className="h-3 w-3" />
          p.{source.page}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="top" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Source {index + 1} · Page {source.page}
            </span>
            {source.score > 0 && (
              <span className="text-xs text-muted-foreground">
                {(source.score * 100).toFixed(0)}% match
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-foreground line-clamp-6">{source.text}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
