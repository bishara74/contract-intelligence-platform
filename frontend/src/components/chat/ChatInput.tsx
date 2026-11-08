import { ArrowUp } from "lucide-react";
import { KeyboardEvent, useEffect, useRef } from "react";

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
  placeholder = "Ask a question about this contract",
}: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with content up to ~6 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSubmit();
    }
  };

  return (
    <form
      className="sheet flex items-end gap-2 rounded-lg p-2 focus-within:border-ink/50"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() && !disabled) onSubmit();
      }}
    >
      <label htmlFor="chat-input" className="sr-only">
        Question
      </label>
      <textarea
        id="chat-input"
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-ink placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send question"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-ink text-white transition-opacity hover:bg-ink/90 disabled:opacity-30"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </form>
  );
}
