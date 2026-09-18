import { authenticatedHeaders } from "../lib/api";
import React, { useState } from "react";
import {
  FlaskConical,
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Sparkles,
  AlertTriangle,
  Clock,
  ChevronRight,
  X,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { StatusBadge } from "../components/StatusBadge";
import { ProjectExperiment } from "../types";
import { EmptyState } from "../components/EmptyState";

export function ExperimentsPage() {
  const { experiments, addExperiment, updateExperimentStatus, currentProject } = useProject();
  const { t, language } = useLanguage();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAiStructuring, setIsAiStructuring] = useState(false);
  const [aiObjective, setAiObjective] = useState("");

  // Form State
  const [title, setTitle] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [control, setControl] = useState("");
  const [variant, setVariant] = useState("");
  const [metric, setMetric] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [risk, setRisk] = useState("");
  const [duration, setDuration] = useState("14 days");
  const [loading, setLoading] = useState(false);

  if (!currentProject) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <EmptyState
          title={t("empty_no_project_title")}
          description={t("empty_no_project_desc")}
        />
      </div>
    );
  }

  const handleAiStructure = async () => {
    if (!aiObjective.trim()) return;
    setIsAiStructuring(true);
    try {
      const res = await fetch("/api/gemini/structure-experiment", {
        method: "POST",
        headers: await authenticatedHeaders(),
        body: JSON.stringify({
          objective: aiObjective,
          projectId: currentProject.id,
        }),
      });
      const data = await res.json();
      if (data.title) setTitle(data.title);
      if (data.hypothesis) setHypothesis(data.hypothesis);
      if (data.control) setControl(data.control);
      if (data.variant) setVariant(data.variant);
      if (data.metric) setMetric(data.metric);
      if (data.expectedResult) setExpectedResult(data.expectedResult);
      if (data.risk) setRisk(data.risk);
      if (data.duration) setDuration(data.duration);
    } catch (e) {
      console.error("AI structuring failed:", e);
    } finally {
      setIsAiStructuring(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addExperiment({
        title,
        hypothesis,
        control,
        variant,
        metric,
        expectedResult,
        risk,
        duration,
      });
      setIsCreateModalOpen(false);
      // Reset
      setTitle("");
      setHypothesis("");
      setControl("");
      setVariant("");
      setMetric("");
      setExpectedResult("");
      setRisk("");
    } catch (err) {
      console.error("Failed to create experiment:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/70 dark:border-zinc-850">
        <div>
          <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono mb-1">
            <span>{language === "pt" ? "EVOLUÇÃO CIENTÍFICA" : "SCIENTIFIC EVOLUTION"}</span>
            <span>•</span>
            <span>{currentProject?.name}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {language === "pt" ? "Experimentos Arquiteturais" : "Architectural Experiments"}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {language === "pt"
              ? "Teste e valide mudanças cientificamente com hipóteses mensuráveis. Mudanças requerem confirmação explícita."
              : "Test and validate changes scientifically with measurable hypotheses. Changes require explicit confirmation."}
          </p>
        </div>

        <button
          id="new-experiment-btn"
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{language === "pt" ? "Novo Experimento" : "New Experiment"}</span>
        </button>
      </div>

      {/* Notice Banner */}
      <div className="p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs text-zinc-600 dark:text-zinc-400 flex items-center space-x-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span>
          <strong>{language === "pt" ? "Diretriz de Segurança:" : "Safety Directive:"}</strong>{" "}
          {language === "pt"
            ? "O AFTER nunca aplica alterações diretamente em produção sem aprovação manual explícita e verificação."
            : "AFTER never applies changes directly to production without explicit manual approval and verification."}
        </span>
      </div>

      {/* Experiments Grid */}
      <div className="grid grid-cols-1 gap-4">
        {experiments.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
            <FlaskConical className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {language === "pt" ? "Nenhum experimento ativo" : "No active experiments"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              {language === "pt"
                ? "Proponha uma hipótese para testar desempenho, UX ou refatoração de dependências antes de aplicá-las."
                : "Propose a hypothesis to test performance, UX, or dependency refactors before committing them."}
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === "pt" ? "Criar Primeiro Experimento" : "Create First Experiment"}</span>
            </button>
          </div>
        ) : (
          experiments.map((exp) => (
            <div
              key={exp.id}
              className="p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-4"
            >
              {/* Top Row: Title + Status + Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                    <FlaskConical className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {exp.title}
                    </h3>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Duration: {exp.duration}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <StatusBadge
                    label={exp.status.toUpperCase()}
                    variant={
                      exp.status === "running"
                        ? "info"
                        : exp.status === "completed"
                        ? "success"
                        : exp.status === "cancelled"
                        ? "danger"
                        : "neutral"
                    }
                  />

                  {exp.status === "draft" && (
                    <button
                      type="button"
                      onClick={() => updateExperimentStatus(exp.id, "running")}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity flex items-center space-x-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Launch</span>
                    </button>
                  )}

                  {exp.status === "running" && (
                    <>
                      <button
                        type="button"
                        onClick={() => updateExperimentStatus(exp.id, "completed")}
                        className="px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Conclude</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateExperimentStatus(exp.id, "cancelled")}
                        className="px-2 py-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Hypothesis */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/80 text-xs space-y-1">
                <span className="font-semibold text-zinc-400 uppercase text-[10px] tracking-wider block">
                  Scientific Hypothesis
                </span>
                <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-serif italic text-sm">
                  "{exp.hypothesis}"
                </p>
              </div>

              {/* Control vs Variant */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/30">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Baseline Control
                  </span>
                  <p className="text-zinc-700 dark:text-zinc-300">{exp.control}</p>
                </div>
                <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/30">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Experimental Variant
                  </span>
                  <p className="text-zinc-700 dark:text-zinc-300 font-medium">{exp.variant}</p>
                </div>
              </div>

              {/* Metrics & Risk footer */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                <div>
                  <strong>Metric:</strong> {exp.metric} ({exp.expectedResult})
                </div>
                <div>
                  <strong>Risk:</strong> {exp.risk}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Experiment Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setIsCreateModalOpen(false)}
          />

          <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 z-50 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center space-x-2">
                <FlaskConical className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Structure New Experiment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Assistant helper bar */}
            <div className="my-5 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-2.5">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Let AFTER Structure the Hypothesis</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={aiObjective}
                  onChange={(e) => setAiObjective(e.target.value)}
                  placeholder="e.g., 'Migrate payment webhook handler to idempotent queue'"
                  className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-xs text-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={handleAiStructure}
                  disabled={isAiStructuring || !aiObjective.trim()}
                  className="px-3 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 disabled:opacity-40 cursor-pointer"
                >
                  {isAiStructuring ? "Formulating..." : "Auto-Draft"}
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="1-Click Checkout fast-lane"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Hypothesis
                </label>
                <textarea
                  rows={2}
                  required
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  placeholder="If [change], then [impact], because [rationale]..."
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Control (Baseline)
                  </label>
                  <input
                    type="text"
                    required
                    value={control}
                    onChange={(e) => setControl(e.target.value)}
                    placeholder="Existing flow"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Variant (Experiment)
                  </label>
                  <input
                    type="text"
                    required
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    placeholder="Proposed change"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Key Metric
                  </label>
                  <input
                    type="text"
                    required
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                    placeholder="p95 TTFB"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Expected Result
                  </label>
                  <input
                    type="text"
                    required
                    value={expectedResult}
                    onChange={(e) => setExpectedResult(e.target.value)}
                    placeholder="+8% conversion"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    required
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="14 days"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Regression Risk Assessment
                </label>
                <input
                  type="text"
                  required
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                  placeholder="Low technical risk, potential fallback needed"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 cursor-pointer"
                >
                  {loading ? "Saving..." : "Save Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
