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
      <div>
        <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono">AFTER / WATCH</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">
          {language === "pt" ? "Observação Contínua" : "Continuous Observation"}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
          {language === "pt"
            ? "Observe o repositório, branches, arquivos e entidades reais do grafo."
            : "Observe the real repository, branches, files, and graph entities."}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {webhookConfigured ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
            )}
            <div>
              <div className="text-sm font-semibold">
                {webhookConfigured
                  ? (language === "pt" ? "Webhook do GitHub conectado" : "GitHub webhook connected")
                  : (language === "pt" ? "Webhook do GitHub não configurado" : "GitHub webhook not configured")}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {webhookConfigured
                  ? (language === "pt" ? "Pushes, PRs, issues e releases podem alimentar a observação." : "Pushes, PRs, issues, and releases can feed observation.")
                  : (language === "pt" ? "A configuração exige GITHUB_WEBHOOK_SECRET e permissão administrativa no repositório." : "Setup requires GITHUB_WEBHOOK_SECRET and repository admin permission.")}
              </p>
            </div>
          </div>
          {!webhookConfigured && (
            <button
              type="button"
              onClick={() => void configureWebhook()}
              disabled={webhookLoading}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium disabled:opacity-50"
            >
              <Webhook className={`w-3.5 h-3.5 ${webhookLoading ? "animate-pulse" : ""}`} />
              {webhookLoading ? "Configurando..." : (language === "pt" ? "Configurar webhook" : "Configure webhook")}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">{language === "pt" ? "Novo watch" : "New watch"}</div>
            <p className="text-[11px] text-zinc-400 mt-1">
              {language === "pt" ? "Escolha uma entidade real já observada pelo AFTER." : "Choose a real entity already observed by AFTER."}
            </p>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WatchTargetType)}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2.5 text-xs"
            >
              {Object.keys(labels).map((key) => (
                <option key={key} value={key}>{language === "pt" ? labels[key as WatchTargetType].pt : labels[key as WatchTargetType].en}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Target</span>
            {targetOptions.length ? (
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2.5 text-xs font-mono"
              >
                {targetOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : (
              <div className="mt-1.5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-3 py-3 text-xs text-zinc-400">
                {language === "pt" ? "Nenhum alvo real disponível para este tipo." : "No real target is available for this type."}
              </div>
            )}
          </label>

          <button
            type="button"
            onClick={() => void addWatch()}
            disabled={saving || !target}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium disabled:opacity-50"
          >
            <Eye className="w-3.5 h-3.5" />
            {saving ? (language === "pt" ? "Salvando..." : "Saving...") : (language === "pt" ? "Começar a observar" : "Start watching")}
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{language === "pt" ? "Alvos observados" : "Watched targets"}</div>
              <div className="text-[11px] text-zinc-400 mt-1">{watchTargets.length} active</div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px] disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="mt-4 space-y-2 max-h-[420px] overflow-auto">
            {watchTargets.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-400">
                {language === "pt" ? "Nenhum watch configurado ainda." : "No watch targets configured yet."}
              </div>
            ) : (
              watchTargets.map((watch) => {
                const Icon = icons[watch.type as WatchTargetType] || Eye;
                const label = labels[watch.type as WatchTargetType];
                return (
                  <div key={watch.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-400">{label ? (language === "pt" ? label.pt : label.en) : watch.type}</div>
                        <div className="font-mono text-xs truncate" title={watch.target}>{watch.target}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeWatch(String(watch.id))}
                      className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      title={language === "pt" ? "Remover" : "Remove"}
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

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 p-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="text-[10px] text-zinc-400 font-mono">
        {loading ? "loading observation state" : `repository: ${currentProject.repository}`}
      </div>
    </div>
  );
}
