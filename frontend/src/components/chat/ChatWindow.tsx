import { Bot, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useChatHistory, useSendMessage } from "@/hooks/useContract";
import { useChatStore } from "@/store/chatStore";
import ChatInput from "./ChatInput";
import MessageBubble from "./MessageBubble";

const STARTER_QUESTIONS = [
  "What are the payment terms?",
  "When can this contract be terminated?",
  "What are my confidentiality obligations?",
  "What law governs this contract?",
];

interface ChatWindowProps {
  contractId: string;
}

export default function ChatWindow({ contractId }: ChatWindowProps) {
  const { inputValue, setInputValue, isSubmitting, setIsSubmitting } = useChatStore();
  const { data: history, isLoading } = useChatHistory(contractId);
  const { mutateAsync: sendMessage } = useSendMessage(contractId);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = history?.messages ?? [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isSubmitting]);

  const handleSubmit = async () => {
    const question = inputValue.trim();
    if (!question || isSubmitting) return;
    setInputValue("");
    setIsSubmitting(true);
    try {
      await sendMessage(question);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading conversation…
          </div>
        ) : messages.length === 0 ? (
          /* Welcome state */
          <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-base mb-1">Ask about this contract</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              I'll answer based only on the contract content and cite the relevant pages.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInputValue(q);
                  }}
                  className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {/* Typing indicator */}
            {isSubmitting && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted border">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                  <span className="flex gap-1 items-center">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        disabled={isSubmitting}
      />
    </div>
  );
}
