import React from "react";
import {
  Sparkles,
  Activity,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  TrendingDown,
  RefreshCw,
  HelpCircle,
  FolderGit2,
  CheckCircle2,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { StatusBadge, SeverityBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";

interface OverviewPageProps {
  onNavigate: (view: string) => void;
  onOpenCreateProject: () => void;
}

export function OverviewPage({ onNavigate, onOpenCreateProject }: OverviewPageProps) {
  const {
    currentProject,
    events,
    insights,
    experiments,
    setSelectedNodeForWhy,
    graphNodes,
    refreshAnalysis,
    isAnalyzing,
  } = useProject();
  const { t, language } = useLanguage();

  if (!currentProject) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <EmptyState
          title={t("empty_no_project_title")}
          description={t("empty_no_project_desc")}
          actionLabel={t("empty_no_project_action")}
          onAction={onOpenCreateProject}
        />
      </div>
    );
  }

  const criticalCount = insights.filter((i) => i.impact === "critical" || i.impact === "high").length;
  const runningExperiments = experiments.filter((e) => e.status === "running").length;

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200/70 dark:border-zinc-850">
        <div>
          <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono mb-1">
            <span className="uppercase">{t("overview_title")}</span>
            <span>•</span>
            <span className="text-zinc-600 dark:text-zinc-300">{currentProject.repository}</span>
            <span>•</span>
            <span>{t("overview_branch")}: {currentProject.branch}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {currentProject.name}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
            {currentProject.description || (language === "pt" ? "Telemetria de saúde evolutiva contínua e memória arquitetural." : "Continuous evolutionary health telemetry and architectural memory.")}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            id="overview-refresh-analysis-btn"
            type="button"
            onClick={refreshAnalysis}
            disabled={isAnalyzing}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-850 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin text-zinc-500" : ""}`} />
            <span>{isAnalyzing ? t("overview_scanning") : t("overview_scan_btn")}</span>
          </button>
        </div>
      </div>

      {/* High-level status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: System Health */}
        <div className="p-5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("overview_health")}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                criticalCount > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
              }`}
            />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {criticalCount > 0 ? t("overview_health_attention") : t("overview_health_healthy")}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {criticalCount > 0
              ? (language === "pt" ? `${criticalCount} itens de alto ou crítico impacto detectados` : `${criticalCount} high or critical impact items detected`)
              : (language === "pt" ? "Nenhuma regressão ou deriva crítica detectada" : "No regressions or critical drift detected")}
          </p>
        </div>

        {/* Card 2: Monitored Nodes */}
        <div className="p-5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("overview_arch_nodes")}</span>
            <Activity className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {graphNodes.length}
            </span>
            <span className="text-xs text-zinc-400 font-mono">{language === "pt" ? "mapeados" : "mapped"}</span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {t("overview_nodes_desc")}
          </p>
        </div>

        {/* Card 3: Active Insights */}
        <div className="p-5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("overview_active_insights")}</span>
            <Sparkles className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {insights.length}
            </span>
            <span className="text-xs text-zinc-400 font-mono">{language === "pt" ? "detectados" : "detected"}</span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {t("overview_insights_desc")}
          </p>
        </div>

        {/* Card 4: Experiments */}
        <div className="p-5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("overview_experiments")}</span>
            <TrendingDown className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {runningExperiments}
            </span>
            <span className="text-xs text-zinc-400 font-mono">{language === "pt" ? "em execução" : "running"}</span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {t("overview_experiments_desc")}
          </p>
        </div>
      </div>

      {/* Two-Column Grid: Anomalies / Insights + Recent Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Actionable Insights */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t("overview_actionable_drift")}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("insights")}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1 cursor-pointer"
            >
              <span>{t("overview_view_all")} ({insights.length})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {insights.length === 0 ? (
            <div className="p-6 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 text-center text-xs text-zinc-500">
              {t("overview_no_anomalies")}
            </div>
          ) : (
            <div className="space-y-3">
              {insights.slice(0, 3).map((ins) => (
                <div
                  key={ins.id}
                  className="p-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <StatusBadge label={ins.category} variant="neutral" />
                      <SeverityBadge severity={ins.impact} />
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {ins.affectedComponents?.join(", ")}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {ins.title}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {ins.description}
                  </p>

                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-850 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                      <strong>{language === "pt" ? "Evidência" : "Evidence"}:</strong> {ins.evidence}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate("insights")}
                      className="text-zinc-900 dark:text-zinc-100 font-medium text-xs hover:underline cursor-pointer ml-4 shrink-0"
                    >
                      {t("overview_investigate")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Recent Timeline Activity */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t("overview_recent_evolution")}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("timeline")}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1 cursor-pointer"
            >
              <span>{t("nav_timeline")} ({events.length})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 space-y-4">
            {events.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">{language === "pt" ? "Nenhum evento registrado ainda." : "No events logged yet."}</p>
            ) : (
              <div className="space-y-3.5">
                {events.slice(0, 4).map((ev) => (
                  <div key={ev.id} className="text-xs space-y-1 pb-3 border-b border-zinc-100 dark:border-zinc-850 last:border-none last:pb-0">
                    <div className="flex items-center justify-between text-zinc-400 text-[11px] font-mono">
                      <span>{ev.actor}</span>
                      <span>{ev.timestamp}</span>
                    </div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {ev.event}
                    </p>
                    {ev.reason && (
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        <strong>{language === "pt" ? "Por quê" : "Why"}:</strong> {ev.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Rationale Inspector prompt */}
          <div className="p-4 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 space-y-2 shadow-xs">
            <div className="flex items-center space-x-2 text-xs font-semibold">
              <HelpCircle className="w-4 h-4" />
              <span>{t("overview_why_exists_title")}</span>
            </div>
            <p className="text-xs opacity-80 leading-relaxed">
              {t("overview_why_exists_desc")}
            </p>
            <button
              type="button"
              onClick={() => onNavigate("graph")}
              className="mt-2 w-full py-2 rounded-xl bg-white/20 dark:bg-black/10 hover:bg-white/30 dark:hover:bg-black/20 text-xs font-medium transition-colors cursor-pointer"
            >
              {t("overview_open_graph")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
