import React, { useEffect, useState, useCallback } from "react";
import {
  FileCode2,
  GitCommit,
  Users,
  Layers,
  RefreshCw,
  GitBranch,
  Calendar,
  AlertCircle,
  TrendingUp,
  Boxes,
  ExternalLink,
  ChevronRight,
  Code2,
  Sparkles,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { authenticatedHeaders } from "../lib/api";

export interface ProjectStatsData {
  linesOfCode: number;
  totalCommits: number;
  activeContributors: number;
  fileCount?: number;
  architectureNodes?: number;
  architectureEdges?: number;
  insightsCount?: number;
  experimentsCount?: number;
  openIssues?: number;
  stars?: number;
  branch?: string;
  lastActivity?: string;
  contributors?: Array<{
    name: string;
    avatarUrl?: string;
    contributions: number;
  }>;
  languages?: Record<string, number>;
}

export interface ProjectStatisticsProps {
  projectId?: string;
  className?: string;
  compact?: boolean;
  onNavigate?: (view: string) => void;
}

export function ProjectStatistics({
  projectId: propProjectId,
  className = "",
  compact = false,
  onNavigate,
}: ProjectStatisticsProps) {
  const { currentProject } = useProject();
  const { language } = useLanguage();

  const activeProjectId = propProjectId || currentProject?.id;
  const isPt = language === "pt";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProjectStatsData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatistics = useCallback(async () => {
    if (!activeProjectId) {
      setStats(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = await authenticatedHeaders();
      const response = await fetch(
        `/api/projects?projectId=${encodeURIComponent(activeProjectId)}`,
        { headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${response.status}: Failed to load project statistics`
        );
      }

      const data = await response.json();
      if (data && data.statistics) {
        setStats(data.statistics);
        setLastUpdated(new Date());
      } else {
        throw new Error("No statistics returned by server");
      }
    } catch (err: any) {
      console.warn("Could not query /api/projects for statistics:", err);
      setError(err?.message || "Failed to load statistics");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  if (!activeProjectId) {
    return (
      <div
        className={`p-6 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-center ${className}`}
      >
        <Code2 className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {isPt ? "Nenhum projeto selecionado" : "No project selected"}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {isPt
            ? "Selecione ou conecte um projeto para visualizar métricas e telemetria."
            : "Select or connect a project to view metrics and telemetry."}
        </p>
      </div>
    );
  }

  // Calculate language distribution percentages if available
  const languageList = Object.entries(stats?.languages || {});
  const totalLanguageBytes = languageList.reduce((acc, [, bytes]) => acc + (bytes || 0), 0);
  const sortedLanguages = languageList
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([name, bytes]) => ({
      name,
      percentage: totalLanguageBytes > 0 ? Math.round((bytes / totalLanguageBytes) * 100) : 0,
    }));

  const languageColors: Record<string, string> = {
    TypeScript: "bg-blue-500",
    JavaScript: "bg-amber-400",
    Python: "bg-emerald-500",
    Rust: "bg-orange-500",
    Go: "bg-cyan-500",
    HTML: "bg-rose-500",
    CSS: "bg-indigo-500",
  };

  return (
    <div
      className={`rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 sm:p-6 shadow-xs space-y-6 transition-all ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shadow-xs">
            <BarChartIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {isPt ? "Estatísticas do Projeto" : "Project Statistics"}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                /api/projects
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {currentProject?.name || activeProjectId}
              {stats?.branch && (
                <span className="ml-2 font-mono text-[11px] text-zinc-400 inline-flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  {stats.branch}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <span className="text-[11px] text-zinc-400 font-mono hidden md:inline">
              {isPt ? "Atualizado: " : "Updated: "}
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            onClick={fetchStatistics}
            disabled={loading}
            title={isPt ? "Atualizar estatísticas" : "Refresh statistics"}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-zinc-800 dark:text-zinc-200" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error notification if any */}
      {error && !loading && (
        <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-xs text-rose-700 dark:text-rose-400 flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-medium">{isPt ? "Erro ao carregar telemetria: " : "Error loading telemetry: "}</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchStatistics}
            className="underline font-medium hover:text-rose-900 dark:hover:text-rose-200 shrink-0"
          >
            {isPt ? "Tentar novamente" : "Retry"}
          </button>
        </div>
      )}

      {/* Main Metric Cards Grid (Lines of Code, Total Commits, Active Contributors) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Lines of Code */}
        <div className="p-4 sm:p-5 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/40 flex flex-col justify-between space-y-4 hover:border-zinc-300 dark:hover:border-zinc-750 transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {isPt ? "Linhas de Código" : "Lines of Code"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileCode2 className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline space-x-2">
              {loading && !stats ? (
                <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-950 dark:text-zinc-50">
                  {(stats?.linesOfCode || 0).toLocaleString()}
                </span>
              )}
              <span className="text-xs font-mono text-zinc-400">LOC</span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              {isPt
                ? `Rastreado em ~${stats?.fileCount || 14} módulos e arquivos de origem`
                : `Observed across ~${stats?.fileCount || 14} source modules`}
            </p>
          </div>

          {/* Mini language bar indicator */}
          {sortedLanguages.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/60">
              <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                {sortedLanguages.map((lang) => (
                  <div
                    key={lang.name}
                    style={{ width: `${lang.percentage}%` }}
                    className={`${languageColors[lang.name] || "bg-zinc-400"} transition-all`}
                    title={`${lang.name}: ${lang.percentage}%`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span>{sortedLanguages[0]?.name || "Code"} ({sortedLanguages[0]?.percentage}%)</span>
                {sortedLanguages[1] && (
                  <span>{sortedLanguages[1]?.name} ({sortedLanguages[1]?.percentage}%)</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Metric 2: Total Commits */}
        <div className="p-4 sm:p-5 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/40 flex flex-col justify-between space-y-4 hover:border-zinc-300 dark:hover:border-zinc-750 transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {isPt ? "Total de Commits" : "Total Commits"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <GitCommit className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline space-x-2">
              {loading && !stats ? (
                <div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-950 dark:text-zinc-50">
                  {(stats?.totalCommits || 0).toLocaleString()}
                </span>
              )}
              <span className="text-xs font-mono text-zinc-400">
                {isPt ? "commits" : "commits"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              {isPt
                ? "Histórico registrado no livro-razão e branch de desenvolvimento"
                : "Continuous evolutionary history recorded on active branch"}
            </p>
          </div>

          <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3 text-zinc-400" />
              {isPt ? "Última atividade: " : "Last activity: "}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300">
              {stats?.lastActivity
                ? new Date(stats.lastActivity).toLocaleDateString(isPt ? "pt-BR" : "en-US")
                : (isPt ? "Ativo" : "Active")}
            </span>
          </div>
        </div>

        {/* Metric 3: Active Contributors */}
        <div className="p-4 sm:p-5 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/40 flex flex-col justify-between space-y-4 hover:border-zinc-300 dark:hover:border-zinc-750 transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {isPt ? "Contribuidores Ativos" : "Active Contributors"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline space-x-2">
              {loading && !stats ? (
                <div className="h-8 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-950 dark:text-zinc-50">
                  {(stats?.activeContributors || 1).toLocaleString()}
                </span>
              )}
              <span className="text-xs font-mono text-zinc-400">
                {isPt ? "autores" : "authors"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              {isPt
                ? "Engenheiros com contribuições ativas em código e revisões"
                : "Engineers driving commits, reviews, and architecture drift"}
            </p>
          </div>

          {/* Top contributor avatar stack or pill */}
          <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/60 flex items-center justify-between">
            {stats?.contributors && stats.contributors.length > 0 ? (
              <div className="flex items-center space-x-1.5 overflow-hidden">
                <div className="flex -space-x-1.5">
                  {stats.contributors.slice(0, 3).map((c, i) => (
                    <div
                      key={c.name + i}
                      title={`${c.name} (${c.contributions} ${isPt ? "ações" : "contributions"})`}
                      className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[9px] font-semibold text-zinc-700 dark:text-zinc-200"
                    >
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={c.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        c.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-[130px]">
                  {stats.contributors[0]?.name}
                  {stats.contributors.length > 1 && ` +${stats.contributors.length - 1}`}
                </span>
              </div>
            ) : (
              <span className="text-[11px] font-mono text-zinc-400">
                {isPt ? "Equipe monitorada" : "Monitored team"}
              </span>
            )}

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("repository")}
                className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>{isPt ? "Ver" : "View"}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Auxiliary Telemetry Details (Architecture Nodes, Open Issues, Stars) */}
      {!compact && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-900/20">
            <div className="flex items-center space-x-1.5 text-zinc-400 text-[11px]">
              <Layers className="w-3.5 h-3.5" />
              <span>{isPt ? "Nós Arquiteturais" : "Architecture Nodes"}</span>
            </div>
            <div className="mt-1 text-base font-semibold font-mono text-zinc-900 dark:text-zinc-100">
              {stats.architectureNodes ?? 0}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-900/20">
            <div className="flex items-center space-x-1.5 text-zinc-400 text-[11px]">
              <Boxes className="w-3.5 h-3.5" />
              <span>{isPt ? "Arestas de Conexão" : "Dependency Edges"}</span>
            </div>
            <div className="mt-1 text-base font-semibold font-mono text-zinc-900 dark:text-zinc-100">
              {stats.architectureEdges ?? 0}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-900/20">
            <div className="flex items-center space-x-1.5 text-zinc-400 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{isPt ? "Issues Abertas" : "Open Issues"}</span>
            </div>
            <div className="mt-1 text-base font-semibold font-mono text-zinc-900 dark:text-zinc-100">
              {stats.openIssues ?? 0}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-900/20">
            <div className="flex items-center space-x-1.5 text-zinc-400 text-[11px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isPt ? "Insights Gerados" : "Active Insights"}</span>
            </div>
            <div className="mt-1 text-base font-semibold font-mono text-zinc-900 dark:text-zinc-100">
              {stats.insightsCount ?? 0}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BarChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
export default ProjectStatistics;
