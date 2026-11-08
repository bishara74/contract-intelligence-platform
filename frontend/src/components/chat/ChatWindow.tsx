import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DEMO_QUESTIONS } from "@/demo/sampleContract";
import { useChatHistory, useSendMessage } from "@/hooks/useContract";
import { useChatStore } from "@/store/chatStore";
import ChatInput from "./ChatInput";
import MessageBubble, { UserMessage } from "./MessageBubble";

const STARTER_QUESTIONS = DEMO_QUESTIONS;

export default function ChatWindow({ contractId }: { contractId: string }) {
  const { inputValue, setInputValue, isSubmitting, setIsSubmitting } = useChatStore();
  const { data: history, isLoading } = useChatHistory(contractId);
  const { mutateAsync: sendMessage } = useSendMessage(contractId);
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = history?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || isSubmitting) return;
    setInputValue("");
    setFailed(false);
    setPending(question);
    setIsSubmitting(true);
    try {
      await sendMessage(question);
    } catch {
      setFailed(true);
      setInputValue(question);
    } finally {
      setPending(null);
      setIsSubmitting(false);
    }
  };

  const empty = !isLoading && messages.length === 0 && !pending;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 py-6">
          {isLoading && (
            <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
            </p>
          )}

          {empty && (
            <div className="py-6 sm:py-12">
              <h2 className="text-2xl font-bold tracking-tight text-ink">Ask about this contract</h2>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                Answers are drawn only from the contract text, and each one links to the pages it came from.
              </p>
              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {STARTER_QUESTIONS.map((q) => (
                  <li key={q}>
                    <button
                      onClick={() => ask(q)}
                      className="w-full rounded-md border border-input bg-card px-4 py-3 text-left text-[15px] text-ink hover:border-ink/50"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {pending && (
            <>
              {/* Demo history already includes the question; avoid showing it twice */}
              {messages.at(-1)?.content !== pending && <UserMessage content={pending} />}
              <div className="sheet flex w-fit items-center gap-2 rounded-lg rounded-bl-sm px-5 py-4 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching the contract…
              </div>
            </>
          )}

          {failed && (
            <p className="flex items-center gap-2 text-sm text-redline" role="alert">
              <AlertCircle className="h-4 w-4" />
              The question couldn’t be answered. The server may be starting up; try again in a minute.
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex-none px-5 pb-5">
        <div className="mx-auto max-w-3xl">
          <ChatInput value={inputValue} onChange={setInputValue} onSubmit={() => ask(inputValue)} disabled={isSubmitting} />
        </div>
      </div>
    </div>
  );
}
