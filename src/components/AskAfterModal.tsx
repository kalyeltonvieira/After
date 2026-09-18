import { authenticatedHeaders } from "../lib/api";
import React, { useState } from "react";
import { X, Sparkles, Send, ArrowUpRight, Search, FileText, CheckCircle } from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { ConfidenceBadge } from "./StatusBadge";
import { AskAfterResult } from "../types";

export function AskAfterModal() {
  const { isAskAfterOpen, setIsAskAfterOpen, currentProject, events, insights, graphNodes } =
    useProject();
  const [queryText, setQueryText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskAfterResult | null>(null);

  const suggestedQuestions = [
    "What changed in recent commits?",
    "Why does this component exist?",
    "Are there any unpinned dependencies?",
    "Find potential architectural risks.",
    "What should I investigate next?",
  ];

  const handleAsk = async (question: string) => {
    if (!question.trim()) return;
    setLoading(true);
    setQueryText(question);
    try {
      const res = await fetch("/api/gemini/ask", {
        method: "POST",
        headers: await authenticatedHeaders(),
        body: JSON.stringify({ question, projectId: currentProject?.id }),

      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Failed to query AFTER intelligence:", err);
      setResult({
        answer: "Failed to query backend intelligence service. Verify server connection.",
        citedEvidence: [],
        suggestedInvestigation: [],
        confidence: "low",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAskAfterOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsAskAfterOpen(false)}
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Ask AFTER
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Grounded architectural intelligence for {currentProject?.name || "your project"}
              </p>
            </div>
          </div>
          <button
            id="close-ask-after-btn"
            type="button"
            onClick={() => setIsAskAfterOpen(false)}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Form */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(queryText);
            }}
            className="relative"
          >
            <input
              id="ask-after-input"
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Ask anything about changes, regressions, or dependencies..."
              className="w-full pl-4 pr-12 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 shadow-xs"
            />
            <button
              id="submit-ask-after-btn"
              type="submit"
              disabled={loading || !queryText.trim()}
              className="absolute right-2 top-2 p-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Quick chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-zinc-400 mr-1">Suggestions:</span>
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAsk(q)}
                className="text-xs px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors cursor-pointer active:scale-98"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Sparkles className="w-6 h-6 animate-spin text-zinc-400" />
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Correlating commit logs, architecture nodes, and telemetry traces...
              </p>
            </div>
          ) : result ? (
            <div className="space-y-6">
              {/* Answer Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Engine Answer
                  </span>
                  {result.confidence && <ConfidenceBadge confidence={result.confidence} />}
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-line">
                  {result.answer}
                </div>
              </div>

              {/* Cited Evidence */}
              {result.citedEvidence && result.citedEvidence.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Cited Evidence from Project History</span>
                  </span>
                  <ul className="space-y-1.5">
                    {result.citedEvidence.map((ev, idx) => (
                      <li
                        key={idx}
                        className="text-xs p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 text-zinc-700 dark:text-zinc-300 flex items-start space-x-2"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Investigation */}
              {result.suggestedInvestigation && result.suggestedInvestigation.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
                    <Search className="w-3.5 h-3.5" />
                    <span>Recommended Investigation</span>
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {result.suggestedInvestigation.map((inv, idx) => (
                      <div
                        key={idx}
                        className="text-xs p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800 flex items-center justify-between"
                      >
                        <span>{inv}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Ask any question to inspect changes, dependencies, or architectural rationale.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
