import { useEffect, useRef, useState } from "react";
import { Send, Trash2, MessageCircle } from "lucide-react";
import { sendChat } from "../../services/api";
import type { ChatMessage } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";

interface ChatViewProps {
  documentId?: string;
  rawText?: string;
  hasDocument: boolean;
}

export function ChatView({ documentId, rawText, hasDocument }: ChatViewProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`loupe-chat-${documentId || "default"}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(`loupe-chat-${documentId || "default"}`, JSON.stringify(messages));
    } catch {}
  }, [messages, documentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;
    const newUser: ChatMessage = { role: "user", content: q };
    setMessages((m) => [...m, newUser]);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await sendChat({ question: q, document_id: documentId, raw_text: rawText, history: [...messages, newUser] });
      const assistant: ChatMessage = { role: "assistant", content: res.answer };
      setMessages((m) => [...m, assistant]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    try {
      localStorage.removeItem(`loupe-chat-${documentId || "default"}`);
    } catch {}
  };

  if (!hasDocument) {
    return (
      <div data-testid="chat-view" className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center">
          <MessageCircle size={24} className="mx-auto text-zinc-400" />
          <h3 className="mt-3 text-sm font-semibold text-zinc-900">{t("No contract loaded")}</h3>
          <p className="mt-1 text-sm text-zinc-500">{t("Analyze a contract first to chat about it. Your chat will use the uploaded document as context.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="chat-view" className="flex h-full flex-col bg-zinc-50">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">{t("AI Chat")}</h2>
          <p className="text-xs text-zinc-500">
            {t("Ask about")} {documentId || t("your contract")}
          </p>
        </div>
        <button
          type="button"
          data-testid="chat-clear"
          onClick={handleClear}
          className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
          <Trash2 size={12} /> {t("Clear")}
        </button>
      </div>
      <div data-testid="chat-messages" className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-4 text-center">
            <p className="text-sm text-zinc-700">{t("Start a conversation")}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {t("Examples: “What is the liability cap?” · “Which clauses are one-sided?” · “Summarize termination”")}
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} data-testid={`chat-msg-${i}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-6 sm:max-w-[75%] sm:px-4 ${m.role === "user" ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-900"}`}>
              {t(m.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500">{t("Thinking…")}</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {error && (
        <div data-testid="chat-error" className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 sm:px-6">
          {error}
        </div>
      )}
      <div className="border-t border-zinc-200 bg-white p-3 sm:p-4">
        <div className="flex gap-2">
          <input
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("Ask about your contract…")}
            className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
          <button
            type="button"
            data-testid="chat-send"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
            <Send size={14} /> {t("Send")}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-400">{t("Answers are based on your uploaded document. We do not use external knowledge.")}</p>
      </div>
    </div>
  );
}
