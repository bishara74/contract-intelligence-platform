import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";
import SourceCitation from "./SourceCitation";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground border"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble + sources */}
      <div className={cn("flex max-w-[75%] flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm bg-muted text-foreground"
          )}
        >
          {/* Render newlines as line breaks */}
          {message.content.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              {i < message.content.split("\n").length - 1 && <br />}
            </span>
          ))}
        </div>

        {/* Source citations (assistant only) */}
        {!isUser && message.source_chunks && message.source_chunks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {message.source_chunks.map((source, i) => (
              <SourceCitation key={i} source={source} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
