import React, { useState } from "react";
import {
  Sparkles,
  Filter,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  Plus,
  Zap,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { StatusBadge, SeverityBadge, ConfidenceBadge } from "../components/StatusBadge";
import { InsightCategory, ProjectInsight } from "../types";
import { EmptyState } from "../components/EmptyState";

export function InsightsPage({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { insights, refreshAnalysis, isAnalyzing, addExperiment, currentProject } = useProject();
  const { t, language } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [creatingExpId, setCreatingExpId] = useState<string | null>(null);

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

  const categories = [
    "All",
    "Bug risk",
    "Security",
    "Performance",
    "UX",
    "Cost",
    "Dependency",
    "Architecture",
    "Opportunity",
  ];

  const filteredInsights = insights.filter((i) => {
    if (selectedCategory === "All") return true;
    return i.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  const handleCreateExperimentFromInsight = async (insight: ProjectInsight) => {
    setCreatingExpId(insight.id);
    try {
      await addExperiment({
        title: `Resolve: ${insight.title}`,
        hypothesis: `If we address ${insight.title} by applying "${insight.suggestedAction}", we mitigate ${insight.category} risks and improve system stability.`,
        control: "Existing architecture without remediation",
        variant: insight.suggestedAction,
        metric: `${insight.category} error rate / latency traces`,
        expectedResult: "Measure the change against the project baseline; no quantified result is known yet.",
        risk: "Risk must be validated with tests and observed project telemetry.",
        duration: "7 days",
      });
      onNavigate("experiments");
    } catch (err) {
      console.error("Failed to convert insight to experiment:", err);
    } finally {
      setCreatingExpId(null);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/70 dark:border-zinc-850">
        <div>
          <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono mb-1">
            <span>{language === "pt" ? "RADAR CONTÍNUO" : "CONTINUOUS RADAR"}</span>
            <span>•</span>
            <span>{currentProject?.name}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t("insights_title")}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {t("insights_subtitle")}
          </p>
        </div>

        <button
          id="insights-scan-btn"
          type="button"
          onClick={refreshAnalysis}
          disabled={isAnalyzing}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
          <span>{isAnalyzing ? t("overview_scanning") : t("insights_scan_btn")}</span>
        </button>
      </div>

      {insights.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-4 max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t("insights_empty_title")}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
            {t("insights_empty_desc")}
          </p>
          <button
            type="button"
            onClick={refreshAnalysis}
            disabled={isAnalyzing}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
            <span>{isAnalyzing ? t("overview_scanning") : t("insights_empty_btn")}</span>
          </button>
        </div>
      ) : (
        <>
          {/* Category Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-2">
            {categories.map((cat) => {
              const count =
                cat === "All"
                  ? insights.length
                  : insights.filter((i) => i.category.toLowerCase() === cat.toLowerCase()).length;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center space-x-1.5 ${
                    selectedCategory === cat
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span>{cat === "All" ? (language === "pt" ? "Todos" : "All") : cat}</span>
                  <span
                    className={`text-[10px] px-1.5 rounded-full ${
                      selectedCategory === cat
                        ? "bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900"
                        : "bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Cards List */}
          <div className="space-y-4">
            {filteredInsights.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {language === "pt" ? "Nenhuma anomalia detectada nesta categoria" : "No anomalies detected in this category"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {language === "pt" ? "Dispare uma nova varredura forense para avaliar commits recentes e telemetria." : "Trigger a new forensic scan to evaluate recent git commits and telemetry."}
                </p>
              </div>
            ) : (
              filteredInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="p-5 sm:p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-4"
                >
                  {/* Header tags */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <StatusBadge label={insight.category} variant="neutral" />
                      <SeverityBadge severity={insight.impact} />
                      <ConfidenceBadge confidence={insight.confidence} />
                    </div>
                    <div className="flex items-center space-x-1 text-xs text-zinc-400 font-mono">
                      <span>{language === "pt" ? "Componentes:" : "Components:"}</span>
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {insight.affectedComponents?.join(", ") || (language === "pt" ? "Global" : "Global")}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {insight.title}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1.5 leading-relaxed">
                      {insight.description}
                    </p>
                  </div>

                  {/* Evidence quote */}
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-xs">
                    <span className="font-semibold text-zinc-500 uppercase text-[10px] tracking-wider block mb-0.5">
                      {language === "pt" ? "Evidência Técnica Observada" : "Technical Evidence Observed"}
                    </span>
                    <p className="text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
                      {insight.evidence}
                    </p>
                  </div>

                  {/* Action row */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      <strong className="text-zinc-800 dark:text-zinc-200">{language === "pt" ? "Ação Sugerida" : "Suggested Action"}:</strong>{" "}
                      {insight.suggestedAction}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCreateExperimentFromInsight(insight)}
                      disabled={creatingExpId === insight.id}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t("insights_turn_into_experiment")}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
