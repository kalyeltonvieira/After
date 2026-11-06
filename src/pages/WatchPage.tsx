import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileCode2,
  GitBranch,
  Globe2,
  Network,
  Package,
  RefreshCw,
  Trash2,
  Webhook,
  Activity,
  GitCommit,
  GitPullRequest,
  CircleDot,
  Radio,
  ExternalLink,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { authenticatedHeaders } from "../lib/api";
import type { WatchTargetType } from "../types";

const labels: Record<WatchTargetType, { pt: string; en: string }> = {
  repository: { pt: "Repositório", en: "Repository" },
  branch: { pt: "Branch", en: "Branch" },
  file: { pt: "Arquivo", en: "File" },
  component: { pt: "Componente", en: "Component" },
  dependency: { pt: "Dependência", en: "Dependency" },
  node: { pt: "Nó do grafo", en: "Graph node" },
};

const icons: Record<WatchTargetType, React.ComponentType<{ className?: string }>> = {
  repository: Globe2,
  branch: GitBranch,
  file: FileCode2,
  component: Network,
  dependency: Package,
  node: Eye,
};

export function WatchPage() {
  const { currentProject } = useProject();
  const { language } = useLanguage();

  const [watchTargets, setWatchTargets] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [type, setType] = useState<WatchTargetType>("repository");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectId = currentProject?.id;
  const events = currentProject?.events || [];

  const request = async (path: string, init?: RequestInit) => {
    const res = await fetch(path, {
      ...init,
      headers: {
        ...(await authenticatedHeaders({}, true)),
        ...(init?.headers || {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  };

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [watch, branchData, treeData] = await Promise.all([
        request(`/api/repository/watch?projectId=${encodeURIComponent(projectId)}`),
        request(`/api/repository/branches?projectId=${encodeURIComponent(projectId)}&per_page=100`),
        request(`/api/repository/tree?projectId=${encodeURIComponent(projectId)}`),
      ]);
      setWatchTargets(Array.isArray(watch.watchTargets) ? watch.watchTargets : []);
      setWebhookConfigured(Boolean(watch.webhookConfigured));
      setBranches(Array.isArray(branchData.branches) ? branchData.branches : []);
      setFiles(
        Array.isArray(treeData.tree)
          ? treeData.tree.filter((item: any) => item.type === "blob").map((item: any) => String(item.path))
          : []
      );
    } catch (err: any) {
      setError(err?.message || (language === "pt" ? "Não foi possível carregar a observação." : "Could not load observation state."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const graphOptions = useMemo(() => {
    const nodes = Array.isArray(currentProject?.graphNodes) ? currentProject.graphNodes : [];
    if (type === "dependency") {
      return nodes
        .filter((node: any) => node.type === "dependency")
        .map((node: any) => ({ value: String(node.dependency || node.id), label: node.label }));
    }
    if (type === "component") {
      return nodes
        .filter((node: any) => ["page", "component", "function", "api", "class", "service", "file"].includes(node.type))
        .map((node: any) => ({ value: node.id, label: node.label }));
    }
    if (type === "node") {
      return nodes.map((node: any) => ({ value: node.id, label: node.label }));
    }
    return [];
  }, [currentProject?.graphNodes, type]);

  const targetOptions = useMemo(() => {
    if (type === "repository") return currentProject?.repository ? [{ value: currentProject.repository, label: currentProject.repository }] : [];
    if (type === "branch") return branches.map((branch) => ({ value: String(branch.name), label: String(branch.name) }));
    if (type === "file") return files.map((file) => ({ value: file, label: file }));
    return graphOptions;
  }, [type, currentProject?.repository, branches, files, graphOptions]);

  useEffect(() => {
    if (!targetOptions.length) {
      setTarget("");
      return;
    }
    if (!targetOptions.some((option) => option.value === target)) {
      setTarget(targetOptions[0].value);
    }
  }, [targetOptions]);

  const addWatch = async () => {
    if (!projectId || !target) return;
    setSaving(true);
    setError(null);
    try {
      const body = await request("/api/repository/watch", {
        method: "POST",
        body: JSON.stringify({ projectId, type, target }),
      });
      setWatchTargets(Array.isArray(body.watchTargets) ? body.watchTargets : []);
    } catch (err: any) {
      setError(err?.message || (language === "pt" ? "Não foi possível salvar a observação." : "Could not save watch target."));
    } finally {
      setSaving(false);
    }
  };

  const removeWatch = async (id: string) => {
    if (!projectId) return;
    setSaving(true);
    try {
      const body = await request(`/api/repository/watch/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });
      setWatchTargets(Array.isArray(body.watchTargets) ? body.watchTargets : []);
    } catch (err: any) {
      setError(err?.message || (language === "pt" ? "Não foi possível remover a observação." : "Could not remove watch target."));
    } finally {
      setSaving(false);
    }
  };

  const configureWebhook = async () => {
    if (!projectId) return;
    setWebhookLoading(true);
    setError(null);
    try {
      const body = await request("/api/projects/webhook", {
        method: "POST",
        body: JSON.stringify({ projectId }),
      });
      setWebhookConfigured(Boolean(body.webhookConfigured));
    } catch (err: any) {
      setError(err?.message || (language === "pt" ? "Não foi possível configurar o webhook." : "Could not configure the webhook."));
    } finally {
      setWebhookLoading(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-500">
          {language === "pt" ? "Conecte um repositório para ativar a observação." : "Connect a repository to activate observation."}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header with Live Signal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-400 font-mono">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>AFTER / WATCH &amp; CONTINUOUS OBSERVATION</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            {language === "pt" ? "Observação Contínua" : "Continuous Observation"}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            {language === "pt"
              ? "Monitore em tempo real repositórios, branches, arquivos e entidades do grafo sem depender de polling estático."
              : "Monitor real-time repositories, branches, files, and graph entities without static polling."}
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-medium self-start sm:self-auto shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
          <span>{language === "pt" ? "Observador Ativo" : "Active Observer"}</span>
        </div>
      </div>

      {/* Webhook Status Banner */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {webhookConfigured ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            )}
            <div>
              <div className="text-sm font-semibold">
                {webhookConfigured
                  ? (language === "pt" ? "Webhook do GitHub Conectado & Ativo" : "GitHub Webhook Connected & Active")
                  : (language === "pt" ? "Webhook do GitHub Pendente" : "GitHub Webhook Pending")}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {webhookConfigured
                  ? (language === "pt" ? "Eventos de Push, PRs, Issues e Releases alimentam a observação contínua." : "Push, PR, Issue, and Release events feed continuous observation.")
                  : (language === "pt" ? "Requer GITHUB_WEBHOOK_SECRET e permissão administrativa no repositório." : "Requires GITHUB_WEBHOOK_SECRET and repository admin permissions.")}
              </p>
            </div>
          </div>
          {!webhookConfigured && (
            <button
              type="button"
              onClick={() => void configureWebhook()}
              disabled={webhookLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
            >
              <Webhook className={`w-3.5 h-3.5 ${webhookLoading ? "animate-spin" : ""}`} />
              <span>{webhookLoading ? (language === "pt" ? "Configurando..." : "Configuring...") : (language === "pt" ? "Configurar Webhook" : "Configure Webhook")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Registration & Active Watched List */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        {/* Left Column: Target Creator */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 bg-white dark:bg-zinc-900/30 shadow-xs">
          <div>
            <div className="text-sm font-semibold">{language === "pt" ? "Adicionar Novo Alvo" : "Add Watch Target"}</div>
            <p className="text-[11px] text-zinc-400 mt-1">
              {language === "pt" ? "Selecione uma entidade mapeada do repositório para vigilância especial." : "Select a mapped repository entity for focused observation."}
            </p>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold font-mono">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WatchTargetType)}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            >
              {Object.keys(labels).map((key) => (
                <option key={key} value={key}>
                  {language === "pt" ? labels[key as WatchTargetType].pt : labels[key as WatchTargetType].en}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold font-mono">Target</span>
            {targetOptions.length ? (
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                {targetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-1.5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-3 py-3 text-xs text-zinc-400">
                {language === "pt" ? "Nenhum alvo disponível para este tipo." : "No target available for this type."}
              </div>
            )}
          </label>

          <button
            type="button"
            onClick={() => void addWatch()}
            disabled={saving || !target}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{saving ? (language === "pt" ? "Salvando..." : "Saving...") : (language === "pt" ? "Iniciar Observação" : "Start Watching")}</span>
          </button>
        </div>

        {/* Right Column: Active Targets */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900/30 shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <div className="text-sm font-semibold">{language === "pt" ? "Alvos em Observação" : "Watched Targets"}</div>
              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{watchTargets.length} {language === "pt" ? "alvo(s) ativos" : "active target(s)"}</div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="mt-3 space-y-2 max-h-[380px] overflow-y-auto">
            {watchTargets.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400">
                {language === "pt" ? "Nenhum alvo de observação configurado ainda." : "No watch targets configured yet."}
              </div>
            ) : (
              watchTargets.map((watch) => {
                const Icon = icons[watch.type as WatchTargetType] || Eye;
                const label = labels[watch.type as WatchTargetType];
                return (
                  <div key={watch.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 px-3.5 py-2.5 bg-zinc-50/50 dark:bg-zinc-950/40">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon className="w-4 h-4 text-sky-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400">{label ? (language === "pt" ? label.pt : label.en) : watch.type}</div>
                        <div className="font-mono text-xs font-medium truncate text-zinc-800 dark:text-zinc-200" title={watch.target}>{watch.target}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeWatch(String(watch.id))}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      title={language === "pt" ? "Remover observador" : "Remove watch"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Live Event Activity Feed */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase font-mono tracking-wider">
              {language === "pt" ? "Feed de Eventos em Tempo Real" : "Real-Time Event Stream"}
            </h2>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">
            {events.length} {language === "pt" ? "eventos capturados" : "captured events"}
          </span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[400px] overflow-y-auto">
          {events.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-400">
              {language === "pt" ? "Nenhum evento registrado ainda." : "No events recorded yet."}
            </p>
          ) : (
            events.slice(0, 30).map((ev: any, idx: number) => {
              const isCommit = ev.id?.startsWith("commit_") || ev.metadata?.type === "commit";
              const isPR = ev.metadata?.type === "pull_request";
              const isIssue = ev.metadata?.type === "issue";

              return (
                <article key={ev.id || idx} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                      {isCommit ? <GitCommit className="w-3.5 h-3.5 text-emerald-500" /> :
                       isPR ? <GitPullRequest className="w-3.5 h-3.5 text-sky-500" /> :
                       isIssue ? <CircleDot className="w-3.5 h-3.5 text-amber-500" /> :
                       <Radio className="w-3.5 h-3.5 text-indigo-500" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{ev.event}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{ev.reason || (language === "pt" ? "Evento capturado pela observação contínua." : "Event captured by continuous observation.")}</div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-zinc-400">
                        <span>{ev.actor || "Git Author"}</span>
                        <span>•</span>
                        <span>{new Date(ev.timestamp).toLocaleString(language === "pt" ? "pt-BR" : "en-US")}</span>
                      </div>
                    </div>
                  </div>

                  {ev.metadata?.url && (
                    <a
                      href={ev.metadata.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors shrink-0"
                      title={language === "pt" ? "Ver no GitHub" : "View on GitHub"}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 p-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
