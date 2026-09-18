import React, { useEffect, useState } from "react";
import { X, Sparkles, AlertCircle, CheckCircle2, HelpCircle, ArrowRight } from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { KnowledgeBadge, SeverityBadge } from "./StatusBadge";
import { WhyAnalysisResult } from "../types";

export function WhyDrawer() {
  const { selectedNodeForWhy, setSelectedNodeForWhy, currentProject, events, graphNodes } = useProject();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhyAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedNodeForWhy) {
      setResult(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const fetchWhy = async () => {
      setLoading(true);
      setError(null);
      try {
        const realDeps = graphNodes
          .filter((n) => n.type === "dependency")
          .map((n) => n.label)
          .slice(0, 10);

        const res = await fetch("/api/gemini/why", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeName: selectedNodeForWhy.label || selectedNodeForWhy.id,
            nodeType: selectedNodeForWhy.type,
            projectContext: currentProject,
            recentEvents: events.slice(0, 8),
            dependencies: realDeps,
          }),
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const data = await res.json();
        if (isMounted) {
          setResult(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Failed to load architectural reasoning");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchWhy();

    return () => {
      isMounted = false;
    };
  }, [selectedNodeForWhy, currentProject, events]);

  if (!selectedNodeForWhy) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={() => setSelectedNodeForWhy(null)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white dark:bg-zinc-900 border-l border-zinc-200/80 dark:border-zinc-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 font-serif italic text-base">
                ?
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Why does this exist?
                  </h2>
                  <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                    {selectedNodeForWhy.type}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-xs mt-0.5">
                  {selectedNodeForWhy.label}
                </p>
              </div>
            </div>
            <button
              id="close-why-drawer-btn"
              type="button"
              onClick={() => setSelectedNodeForWhy(null)}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {loading ? (
              <div className="space-y-4 py-8">
                <div className="flex items-center space-x-3 text-sm text-zinc-500 dark:text-zinc-400">
                  <Sparkles className="w-4 h-4 animate-spin text-zinc-600 dark:text-zinc-300" />
                  <span>Scanning project timeline and architecture topology...</span>
                </div>
                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse w-3/4" />
                <div className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                <div className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                <div className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 text-sm">
                <div className="flex items-center space-x-2 font-medium mb-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>Analysis Error</span>
                </div>
                <p className="text-xs opacity-90">{error}</p>
              </div>
            ) : result ? (
              <>
                {/* Executive Summary */}
                <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 block mb-1">
                    Executive Analysis
                  </span>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed">
                    {result.summary}
                  </p>
                </div>

                {/* Classification Rule Notice */}
                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 py-1 px-2 border-y border-zinc-100 dark:border-zinc-800/60 font-mono">
                  <span>Evidence classification:</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">KNOWN</span>
                    <span>•</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">INFERRED</span>
                    <span>•</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">UNKNOWN</span>
                  </div>
                </div>

                {/* 1. Why it exists */}
                {result.whyExists && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        1. Original Intent & Existence
                      </span>
                      <KnowledgeBadge status={result.whyExists.status} />
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50/40 dark:bg-zinc-800/30 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/60">
                      {result.whyExists.explanation}
                    </p>
                  </div>
                )}

                {/* 2. When created */}
                {result.createdContext && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        2. Historical Creation Context
                      </span>
                      <KnowledgeBadge status={result.createdContext.status} />
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50/40 dark:bg-zinc-800/30 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/60">
                      {result.createdContext.explanation}
                    </p>
                  </div>
                )}

                {/* 3. Problem Solved */}
                {result.problemSolved && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        3. Problem Addressed
                      </span>
                      <KnowledgeBadge status={result.problemSolved.status} />
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50/40 dark:bg-zinc-800/30 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/60">
                      {result.problemSolved.explanation}
                    </p>
                  </div>
                )}

                {/* 4. Dependencies */}
                {result.dependencies && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        4. Dependency Topology
                      </span>
                      <KnowledgeBadge status={result.dependencies.status} />
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {result.dependencies.dependsOn?.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/60">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                            Relies On:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {result.dependencies.dependsOn.map((item, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-700/60 font-mono text-[11px]"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.dependencies.dependedOnBy?.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/60">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                            Depended On By:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {result.dependencies.dependedOnBy.map((item, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-700/60 font-mono text-[11px]"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Removal Risks */}
                {result.removalRisks && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        5. Removal Impact & Risks
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <KnowledgeBadge status={result.removalRisks.status} />
                        <SeverityBadge severity={result.removalRisks.riskLevel} />
                      </div>
                    </div>
                    <ul className="space-y-1.5 bg-rose-50/30 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-200/40 dark:border-rose-900/40">
                      {result.removalRisks.details?.map((detail, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-rose-900 dark:text-rose-300 flex items-start space-x-2"
                        >
                          <span className="text-rose-500 font-bold">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendation */}
                {result.recommendation && (
                  <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 flex items-start space-x-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400 dark:text-emerald-600" />
                    <div>
                      <span className="text-xs font-semibold block uppercase tracking-wider opacity-70">
                        Forensic Recommendation
                      </span>
                      <p className="text-xs font-medium mt-0.5 leading-relaxed">
                        {result.recommendation}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
