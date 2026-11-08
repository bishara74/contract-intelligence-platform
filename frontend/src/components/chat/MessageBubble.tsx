import type { ChatMessage, SourceChunk } from "@/types";
import SourceCitation from "./SourceCitation";

function groupByPage(chunks: SourceChunk[]): [number, SourceChunk[]][] {
  const map = new Map<number, SourceChunk[]>();
  for (const c of chunks) map.set(c.page, [...(map.get(c.page) ?? []), c]);
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[80%] whitespace-pre-line rounded-lg rounded-br-sm bg-ink px-4 py-2.5 text-[15px] leading-relaxed text-white">
        {content}
      </p>
    </div>
  );
}

export default function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") return <UserMessage content={message.content} />;

  const pages = groupByPage(message.source_chunks ?? []);
  return (
    <div className="sheet max-w-[92%] rounded-lg rounded-bl-sm px-5 py-4">
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{message.content}</p>
      {pages.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
          <span className="mr-1 text-xs text-muted-foreground">Sources</span>
          {pages.map(([page, chunks]) => (
            <SourceCitation key={page} page={page} chunks={chunks} />
          ))}
        </div>
      )}
    </div>
  );
}
