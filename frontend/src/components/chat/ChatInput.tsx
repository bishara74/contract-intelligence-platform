import { Send } from "lucide-react";
import { useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = "Ask anything about this contract…",
}: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t bg-background p-3">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "flex-1 resize-none rounded-lg border bg-muted/50 px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 max-h-40 overflow-y-auto",
          "min-h-[40px]"
        )}
        style={{ height: "auto" }}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
        }}
      />
      <Button
        size="icon"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="flex-shrink-0 h-10 w-10"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
