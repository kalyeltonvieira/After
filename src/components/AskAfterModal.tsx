import { authenticatedHeaders } from "../lib/api";
import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Sparkles,
  Send,
  Search,
  FileText,
  CheckCircle2,
  Paperclip,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { ConfidenceBadge } from "./StatusBadge";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citedEvidence?: string[];
  suggestedInvestigation?: string[];
  confidence?: "high" | "medium" | "low";
}

export function AskAfterModal() {
  const {
    isAskAfterOpen,
    setIsAskAfterOpen,
    currentProject,
    aiContext,
  } = useProject();

  const [queryText, setQueryText] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = aiContext?.type === "file"
    ? [
        "Explain this file and its role in the architecture.",
        "What depends on this file?",
        "What could be affected if I change this?",
        "Why does this file exist?",
      ]
    : [
        "Explain this repository architecture.",
        "What changed in recent commits?",
        "What should I investigate next?",
        "Are there dependency or architectural risks?",
      ];

  useEffect(() => {
    if (!isAskAfterOpen) return;
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [isAskAfterOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!isAskAfterOpen) return;
    setQueryText("");
  }, [aiContext?.path, aiContext?.label, isAskAfterOpen]);

  const handleAsk = async (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading || !currentProject) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: cleanQuestion,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setQueryText("");
    setLoading(true);

    try {
      const res = await fetch("/api/gemini/ask", {
        method: "POST",
        headers: await authenticatedHeaders(),
        body: JSON.stringify({
          question: cleanQuestion,
          projectId: currentProject.id,
          context: aiContext,
          history: messages.slice(-10).map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `AI request failed (${res.status})`);
      }

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: data.answer || "No grounded answer was returned.",
        citedEvidence: Array.isArray(data.citedEvidence) ? data.citedEvidence : [],
        suggestedInvestigation: Array.isArray(data.suggestedInvestigation)
          ? data.suggestedInvestigation
          : [],
        confidence: data.confidence,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (error: any) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant_error_${Date.now()}`,
          role: "assistant",
          content:
            error?.message ||
            "Não foi possível consultar a inteligência do AFTER neste momento.",
          confidence: "low",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isAskAfterOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30 lg:bg-transparent"
        onClick={() => setIsAskAfterOpen(false)}
      />

      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[460px] bg-white dark:bg-zinc-950 border-l border-zinc-200/80 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight truncate">Ask AFTER</h2>
                <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {currentProject?.repository || "No repository connected"}
              </p>
            </div>
          </div>
          <button
            id="close-ask-after-btn"
            type="button"
            onClick={() => setIsAskAfterOpen(false)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close Ask AFTER"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                Contexto atual
              </p>
              <p className="text-xs font-mono text-zinc-700 dark:text-zinc-200 truncate">
                {aiContext?.label || currentProject?.repository || "Projeto inteiro"}
              </p>
            </div>
            {aiContext?.type === "file" && (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 px-1.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700">
                arquivo
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-400 mt-2">
            A conversa usa o modelo do projeto, histórico, grafo e o item em foco.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {messages.length === 0 ? (
            <div className="min-h-full flex flex-col justify-center">
              <div className="text-center px-4">
                <div className="mx-auto w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-zinc-500" />
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight">
                  Converse com o contexto do seu software.
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Pergunte sobre código, arquitetura, mudanças, dependências e impacto.
                  O AFTER usa as evidências disponíveis no repositório em vez de inventar contexto.
                </p>
              </div>

              <div className="mt-6 grid gap-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void handleAsk(question)}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[88%] rounded-2xl rounded-br-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3.5 py-2.5 text-sm leading-relaxed"
                        : "w-full max-w-[96%]"
                    }
                  >
                    {message.role === "assistant" ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center">
                            <Sparkles className="w-3 h-3" />
                          </div>
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                            AFTER
                          </span>
                          {message.confidence && <ConfidenceBadge confidence={message.confidence} />}
                        </div>

                        <div className="text-sm leading-6 text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                          {message.content}
                        </div>

                        {message.citedEvidence && message.citedEvidence.length > 0 && (
                          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 p-3 space-y-2">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Evidence
                            </div>
                            {message.citedEvidence.map((item, index) => (
                              <div key={`${message.id}_evidence_${index}`} className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                                {item}
                              </div>
                            ))}
                          </div>
                        )}

                        {message.suggestedInvestigation && message.suggestedInvestigation.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                              <Search className="w-3 h-3" />
                              Continue investigating
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {message.suggestedInvestigation.map((item, index) => (
                                <button
                                  key={`${message.id}_investigation_${index}`}
                                  type="button"
                                  onClick={() => void handleAsk(item)}
                                  className="text-[10px] px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>Investigando o contexto do repositório…</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleAsk(queryText);
            }}
          >
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 focus-within:ring-2 focus-within:ring-zinc-900/10 dark:focus-within:ring-zinc-100/10">
              <textarea
                ref={inputRef}
                id="ask-after-input"
                rows={2}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleAsk(queryText);
                  }
                }}
                placeholder={
                  aiContext?.type === "file"
                    ? `Pergunte sobre ${aiContext.label}…`
                    : "Pergunte ao AFTER sobre este software…"
                }
                className="w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
              />
              <div className="flex items-center justify-between px-2.5 pb-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{aiContext?.type === "file" ? "Arquivo em foco" : "Contexto do projeto"}</span>
                </div>
                <button
                  id="submit-ask-after-btn"
                  type="submit"
                  disabled={loading || !queryText.trim() || !currentProject}
                  className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center hover:opacity-90 disabled:opacity-35 transition-opacity cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-[9px] text-zinc-400 text-right mt-1.5">
              Enter envia · Shift+Enter quebra linha
            </p>
          </form>
        </div>
      </aside>
    </>
  );
}
