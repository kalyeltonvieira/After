import React, { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  GitBranch,
  Loader2,
  RefreshCw,
  GitCompare,
  FileCode2,
  PlusCircle,
  MinusCircle,
  Edit3,
  Search,
  CheckCircle2,
  Layers,
  Network,
  ListFilter,
  Code2,
  Package,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { authenticatedHeaders } from "../lib/api";
import { LanguageColorDot, getLanguageColorByExtension } from "../utils/languageColors";

interface ArchitectureFileChange {
  path: string;
  status: "added" | "removed" | "modified";
  certainty: "KNOWN" | "INFERRED" | "UNKNOWN";
  symbols: {
    added: Array<{ name: string; type: string }>;
    removed: Array<{ name: string; type: string }>;
    modified: Array<{ before?: { name: string }; after?: { name: string } }>;
  };
  dependencies: { added: string[]; removed: string[] };
}

interface RepositoryRefOption {
  value: string;
  ref: string;
  kind: "branch" | "tag";
}

interface ArchitectureComparison {
  repository: string;
  base: { ref: string; treeSha: string; truncated: boolean };
  head: { ref: string; treeSha: string; truncated: boolean };
  completeness: string;
  sourceFilesConsidered: number;
  sourceFilesAnalyzed: number;
  summary: Record<string, number>;
  files: ArchitectureFileChange[];
  limitations: string[];
  generatedAt: string;
}

type ViewMode = "graph" | "files" | "dependencies";
type FilterStatus = "all" | "added" | "removed" | "modified";

export function ArchitectureComparePage() {
  const { currentProject } = useProject();
  const { language } = useLanguage();
  const isPt = language === "pt";

  const [refs, setRefs] = useState<RepositoryRefOption[]>([]);
  const [base, setBase] = useState("");
  const [head, setHead] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ArchitectureComparison | null>(null);

  // Filter & View Mode state
  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedNodePath, setSelectedNodePath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!currentProject?.id) {
        setRefs([]);
        return;
      }
      setLoadingBranches(true);
      setError(null);
      try {
        const query = `projectId=${encodeURIComponent(currentProject.id)}&per_page=100`;
        const headers = await authenticatedHeaders();
        const [branchesResponse, tagsResponse] = await Promise.all([
          fetch(`/api/repository/branches?${query}`, { credentials: "include", headers }),
          fetch(`/api/repository/tags?${query}`, { credentials: "include", headers }),
        ]);
        const [branchesPayload, tagsPayload] = await Promise.all([
          branchesResponse.json(),
          tagsResponse.json(),
        ]);
        if (!branchesResponse.ok) throw new Error(branchesPayload.error || "Could not load repository branches.");
        if (!tagsResponse.ok) throw new Error(tagsPayload.error || "Could not load repository tags.");

        const branchRefs: RepositoryRefOption[] = Array.isArray(branchesPayload.branches)
          ? branchesPayload.branches
              .map((item: any) => item?.name)
              .filter((name: unknown): name is string => typeof name === "string")
              .map((name: string) => ({ value: `branch:${name}`, ref: name, kind: "branch" as const }))
          : [];
        const tagRefs: RepositoryRefOption[] = Array.isArray(tagsPayload.tags)
          ? tagsPayload.tags
              .map((item: any) => item?.name)
              .filter((name: unknown): name is string => typeof name === "string")
              .map((name: string) => ({ value: `tag:${name}`, ref: name, kind: "tag" as const }))
          : [];

        const availableRefs = [...branchRefs, ...tagRefs];
        if (cancelled) return;
        setRefs(availableRefs);

        const defaultRef =
          branchRefs.find((item) => item.ref === (currentProject.defaultBranch || currentProject.branch)) ||
          branchRefs[0] ||
          availableRefs[0];
        const firstValue = defaultRef?.value || "";

        setBase((current) => (current && availableRefs.some((item) => item.value === current) ? current : firstValue));
        setHead((current) =>
          current && availableRefs.some((item) => item.value === current) && current !== firstValue
            ? current
            : availableRefs.find((item) => item.value !== firstValue)?.value || firstValue
        );
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Could not load branches.");
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentProject?.id]);

  const runComparison = async () => {
    const baseOption = refs.find((item) => item.value === base);
    const headOption = refs.find((item) => item.value === head);
    if (!currentProject?.id || !baseOption || !headOption || base === head) return;
    setComparing(true);
    setError(null);
    setComparison(null);
    setSelectedNodePath(null);

    try {
      const response = await fetch("/api/repository/compare-architecture", {
        method: "POST",
        credentials: "include",
        headers: await authenticatedHeaders({}, true),
        body: JSON.stringify({ projectId: currentProject.id, base: baseOption.ref, head: headOption.ref }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Architecture comparison failed.");
      if (!payload.comparison) throw new Error("The API did not return a comparison result.");
      setComparison(payload.comparison as ArchitectureComparison);
    } catch (err: any) {
      setError(err?.message || "Architecture comparison failed.");
    } finally {
      setComparing(false);
    }
  };

  // Filter comparison files
  const filteredFiles = (comparison?.files || []).filter((file) => {
    if (statusFilter !== "all" && file.status !== statusFilter) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      const matchesPath = file.path.toLowerCase().includes(q);
      const matchesSymbols =
        file.symbols.added.some((s) => s.name.toLowerCase().includes(q)) ||
        file.symbols.removed.some((s) => s.name.toLowerCase().includes(q)) ||
        file.symbols.modified.some((s) => (s.before?.name || "").toLowerCase().includes(q) || (s.after?.name || "").toLowerCase().includes(q));
      const matchesDeps = file.dependencies.added.some((d) => d.toLowerCase().includes(q)) || file.dependencies.removed.some((d) => d.toLowerCase().includes(q));
      return matchesPath || matchesSymbols || matchesDeps;
    }
    return true;
  });

  const selectedFileItem = comparison?.files.find((f) => f.path === selectedNodePath) || filteredFiles[0] || null;

  const selectClass =
    "w-full rounded-xl border border-zinc-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 font-mono";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
      {/* Header */}
      <header className="border-b border-zinc-200/80 pb-5 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
            <GitCompare className="h-3.5 w-3.5 text-sky-500" /> AFTER / ARCHITECTURE DIFFERENTIAL
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {isPt ? "Comparador de Arquitetura" : "Architecture Comparator"}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {currentProject?.repository || (isPt ? "Selecione um projeto para comparar branches." : "Select a project to compare branches.")}
          </p>
        </div>
      </header>

      {!currentProject ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center text-sm text-zinc-500">
          {isPt ? "Nenhum projeto selecionado." : "No project selected."}
        </div>
      ) : (
        <>
          {/* Branch & Tag Selector Panel */}
          <section className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40 shadow-xs sm:grid-cols-[1fr_auto_1fr_auto]">
            <label className="space-y-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {isPt ? "Branch / Tag Base (Origem)" : "Base Branch / Tag (Origin)"}
              <select value={base} onChange={(e) => setBase(e.target.value)} className={selectClass} disabled={loadingBranches || comparing}>
                {refs.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.kind}: {item.ref}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-center p-2 text-zinc-400">
              <ArrowLeftRight className="h-4 w-4" />
            </div>

            <label className="space-y-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {isPt ? "Branch / Tag Comparada (Destino)" : "Target Branch / Tag (Head)"}
              <select value={head} onChange={(e) => setHead(e.target.value)} className={selectClass} disabled={loadingBranches || comparing}>
                {refs.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.kind}: {item.ref}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void runComparison()}
              disabled={comparing || loadingBranches || !base || !head || base === head}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer shadow-xs dark:bg-zinc-100 dark:text-zinc-900 shrink-0"
            >
              {comparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span>{comparing ? (isPt ? "Comparando..." : "Comparing...") : (isPt ? "Comparar Arquitetura" : "Compare Architecture")}</span>
            </button>
          </section>

          {loadingBranches && (
            <p className="text-xs text-zinc-500 font-mono animate-pulse">{isPt ? "Carregando branches e tags..." : "Loading branches and tags..."}</p>
          )}

          {comparing && (
            <section aria-label={isPt ? "Comparando arquitetura" : "Comparing architecture"} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-20 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl animate-pulse" />
                ))}
              </div>
              <div className="h-48 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl animate-pulse" />
            </section>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="underline text-[11px] cursor-pointer">
                {isPt ? "Dispensar" : "Dismiss"}
              </button>
            </div>
          )}

          {comparison && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-6">
              {/* Diff Context Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold">{comparison.base.ref}</span>
                  <ArrowLeftRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-200 font-semibold">{comparison.head.ref}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase text-zinc-400">
                    {comparison.completeness === "partial" ? (isPt ? "Análise parcial" : "Partial analysis") : (isPt ? "Completa" : "Complete")}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    ({comparison.sourceFilesAnalyzed} {isPt ? "arquivos fonte" : "source files"})
                  </span>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
                  <p className="font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-zinc-50">{comparison.summary.filesChanged}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{isPt ? "Arquivos Alterados" : "Files Changed"}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/30 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 shadow-xs">
                  <p className="font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{comparison.summary.filesAdded}</p>
                  <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">{isPt ? "Arquivos Adicionados" : "Files Added"}</p>
                </div>
                <div className="rounded-2xl border border-rose-200/60 bg-rose-50/30 p-4 dark:border-rose-900/40 dark:bg-rose-950/20 shadow-xs">
                  <p className="font-mono text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">-{comparison.summary.filesRemoved}</p>
                  <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">{isPt ? "Arquivos Removidos" : "Files Removed"}</p>
                </div>
                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/30 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-xs">
                  <p className="font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">~{comparison.summary.filesModified}</p>
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{isPt ? "Arquivos Modificados" : "Files Modified"}</p>
                </div>
              </div>

              {/* View Switcher & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="inline-flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-xs font-medium border border-zinc-200/70 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setViewMode("graph")}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === "graph" ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>{isPt ? "Grafo de Arquitetura" : "Architecture Graph"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("files")}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === "files" ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>{isPt ? "Lista de Arquivos" : "File List"}</span>
                    <span className="text-[10px] font-mono text-zinc-400">{filteredFiles.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("dependencies")}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === "dependencies" ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>{isPt ? "Matriz de Importações" : "Imports Matrix"}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder={isPt ? "Filtrar por nome de arquivo..." : "Filter by filename..."}
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-zinc-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    />
                  </div>

                  <div className="inline-flex p-0.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/70 dark:border-zinc-800 text-[11px]">
                    {(["all", "added", "removed", "modified"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-2 py-1 rounded-md transition-colors cursor-pointer font-mono uppercase text-[9px] ${
                          statusFilter === st ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 font-bold" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* VIEW 1: GRAPH DIFF CANVAS */}
              {viewMode === "graph" && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
                  <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-950 p-6 space-y-4 min-h-[420px] flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-sky-400" />
                        <span className="text-xs font-semibold text-zinc-100">{isPt ? "Grafo de Alterações Arquiteturais" : "Architecture Change Graph"}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono">
                        <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> + Adicionado</span>
                        <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500" /> ~ Modificado</span>
                        <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-500" /> - Removido</span>
                      </div>
                    </div>

                    {/* Interactive Topology Graph Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-auto">
                      {filteredFiles.slice(0, 15).map((file) => {
                        const isSelected = selectedFileItem?.path === file.path;
                        const statusColor = file.status === "added" ? "emerald" : file.status === "removed" ? "rose" : "amber";
                        const baseName = file.path.split("/").pop() || file.path;

                        return (
                          <button
                            key={file.path}
                            type="button"
                            onClick={() => setSelectedNodePath(file.path)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                              isSelected
                                ? "border-sky-400 bg-sky-950/40 ring-2 ring-sky-400/20"
                                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${
                                file.status === "added" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" :
                                file.status === "removed" ? "bg-rose-950 text-rose-400 border border-rose-800" :
                                "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}>
                                {file.status}
                              </span>
                              <LanguageColorDot filename={file.path} size="xs" />
                            </div>

                            <div>
                              <div className="text-xs font-mono font-semibold text-zinc-100 truncate" title={file.path}>{baseName}</div>
                              <div className="text-[10px] font-mono text-zinc-400 truncate opacity-80">{file.path}</div>
                            </div>

                            <div className="text-[9px] font-mono text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-800/80">
                              <span>+{file.symbols.added.length} / -{file.symbols.removed.length}</span>
                              <span className="text-zinc-300">~{file.symbols.modified.length}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-right text-[10px] font-mono text-zinc-400 pt-2 border-t border-zinc-800">
                      {filteredFiles.length > 15 && `+${filteredFiles.length - 15} ${isPt ? "mais arquivos alterados na visualização" : "more changed files in view"}`}
                    </div>
                  </div>

                  {/* Selected Node Details Drawer */}
                  {selectedFileItem ? (
                    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                          <LanguageColorDot filename={selectedFileItem.path} size="sm" />
                          <span className="text-xs font-semibold font-mono text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]" title={selectedFileItem.path}>
                            {selectedFileItem.path.split("/").pop()}
                          </span>
                        </div>
                        <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                          selectedFileItem.status === "added" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                          selectedFileItem.status === "removed" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                          "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}>
                          {selectedFileItem.status}
                        </span>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <div className="text-[10px] uppercase font-mono text-zinc-400 mb-1">{isPt ? "Caminho do arquivo" : "File Path"}</div>
                          <div className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-all">{selectedFileItem.path}</div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-mono text-zinc-400 mb-1">{isPt ? "Alterações de Símbolos" : "Symbol Changes"}</div>
                          <div className="space-y-1 font-mono text-[11px] max-h-36 overflow-y-auto">
                            {selectedFileItem.symbols.added.map((s) => (
                              <div key={s.name} className="text-emerald-600 dark:text-emerald-400">+ {s.type} {s.name}</div>
                            ))}
                            {selectedFileItem.symbols.removed.map((s) => (
                              <div key={s.name} className="text-rose-600 dark:text-rose-400">- {s.type} {s.name}</div>
                            ))}
                            {selectedFileItem.symbols.modified.map((s, idx) => (
                              <div key={idx} className="text-amber-600 dark:text-amber-400">~ {s.before?.name} → {s.after?.name}</div>
                            ))}
                            {selectedFileItem.symbols.added.length + selectedFileItem.symbols.removed.length + selectedFileItem.symbols.modified.length === 0 && (
                              <div className="text-zinc-400 italic text-[10px]">{isPt ? "Sem alteração em símbolos declarados." : "No declared symbol changes."}</div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-mono text-zinc-400 mb-1">{isPt ? "Importações Afetadas" : "Imports Affected"}</div>
                          <div className="space-y-1 font-mono text-[11px]">
                            {selectedFileItem.dependencies.added.map((dep) => (
                              <div key={dep} className="text-emerald-600 dark:text-emerald-400">+ import {dep}</div>
                            ))}
                            {selectedFileItem.dependencies.removed.map((dep) => (
                              <div key={dep} className="text-rose-600 dark:text-rose-400">- import {dep}</div>
                            ))}
                            {selectedFileItem.dependencies.added.length + selectedFileItem.dependencies.removed.length === 0 && (
                              <div className="text-zinc-400 italic text-[10px]">{isPt ? "Nenhuma importação alterada." : "No import changes."}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* VIEW 2: DETAILED FILE BREAKDOWN */}
              {viewMode === "files" && (
                <section className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-xs">
                  <div className="border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800 flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <FileCode2 className="w-4 h-4 text-sky-500" />
                      <span>{isPt ? "Detalhamento por Arquivo Fonte" : "Source File Breakdown"}</span>
                    </h2>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {filteredFiles.length} {isPt ? "arquivos exibidos" : "files displayed"}
                    </span>
                  </div>

                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {filteredFiles.length === 0 && (
                      <p className="p-8 text-center text-xs text-zinc-400">{isPt ? "Nenhum arquivo encontrado com os filtros atuais." : "No files matched current filters."}</p>
                    )}
                    {filteredFiles.map((file) => (
                      <article key={file.path} className="p-5 space-y-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <LanguageColorDot filename={file.path} size="sm" />
                            <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{file.path}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              file.status === "added" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                              file.status === "removed" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                              "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}>
                              {file.status}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400">{file.certainty}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-[11px] font-mono text-zinc-500">
                          <span>+{file.symbols.added.length} {isPt ? "símbolos" : "symbols"}</span>
                          <span>-{file.symbols.removed.length} {isPt ? "símbolos" : "symbols"}</span>
                          <span>~{file.symbols.modified.length} {isPt ? "modificados" : "modified"}</span>
                          <span>+{file.dependencies.added.length} {isPt ? "deps" : "deps"}</span>
                        </div>

                        {(file.symbols.added.length + file.symbols.removed.length + file.symbols.modified.length + file.dependencies.added.length + file.dependencies.removed.length > 0) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800/80 font-mono text-[11px]">
                            <div className="space-y-1">
                              {file.symbols.modified.map((s, idx) => (
                                <div key={idx} className="text-amber-600 dark:text-amber-400">~ {s.before?.name} → {s.after?.name}</div>
                              ))}
                              {file.symbols.added.map((s) => (
                                <div key={s.name} className="text-emerald-600 dark:text-emerald-400">+ {s.type} {s.name}</div>
                              ))}
                              {file.dependencies.added.map((dep) => (
                                <div key={dep} className="text-emerald-600 dark:text-emerald-400">+ import {dep}</div>
                              ))}
                            </div>
                            <div className="space-y-1">
                              {file.symbols.removed.map((s) => (
                                <div key={s.name} className="text-rose-600 dark:text-rose-400">- {s.type} {s.name}</div>
                              ))}
                              {file.dependencies.removed.map((dep) => (
                                <div key={dep} className="text-rose-600 dark:text-rose-400">- import {dep}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* VIEW 3: DEPENDENCY MATRIX */}
              {viewMode === "dependencies" && (
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-4 shadow-xs">
                  <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Package className="w-4 h-4 text-sky-500" />
                      <span>{isPt ? "Matriz de Alterações de Importação e Dependência" : "Import & Dependency Change Matrix"}</span>
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-emerald-200/70 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-2">
                      <h3 className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 font-mono flex items-center gap-1.5">
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{isPt ? "Novas Importações Adicionadas" : "Newly Added Imports"}</span>
                      </h3>
                      <div className="divide-y divide-emerald-200/50 dark:divide-emerald-900/40 font-mono text-xs">
                        {filteredFiles.flatMap((f) => f.dependencies.added.map((d) => ({ file: f.path, dep: d }))).length === 0 ? (
                          <p className="py-2 text-[11px] text-emerald-700/70 dark:text-emerald-400/70 italic">{isPt ? "Nenhuma nova dependência adicionada." : "No newly added dependencies."}</p>
                        ) : (
                          filteredFiles.flatMap((f) => f.dependencies.added.map((d) => ({ file: f.path, dep: d }))).map((item, idx) => (
                            <div key={idx} className="py-2 flex items-center justify-between gap-2">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">{item.dep}</span>
                              <span className="text-[10px] text-zinc-400 truncate max-w-[180px]" title={item.file}>{item.file.split("/").pop()}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-rose-200/70 bg-rose-50/30 dark:border-rose-900/40 dark:bg-rose-950/20 space-y-2">
                      <h3 className="text-xs font-semibold text-rose-800 dark:text-rose-300 font-mono flex items-center gap-1.5">
                        <MinusCircle className="w-3.5 h-3.5" />
                        <span>{isPt ? "Importações Removidas" : "Removed Imports"}</span>
                      </h3>
                      <div className="divide-y divide-rose-200/50 dark:divide-rose-900/40 font-mono text-xs">
                        {filteredFiles.flatMap((f) => f.dependencies.removed.map((d) => ({ file: f.path, dep: d }))).length === 0 ? (
                          <p className="py-2 text-[11px] text-rose-700/70 dark:text-rose-400/70 italic">{isPt ? "Nenhuma dependência removida." : "No removed dependencies."}</p>
                        ) : (
                          filteredFiles.flatMap((f) => f.dependencies.removed.map((d) => ({ file: f.path, dep: d }))).map((item, idx) => (
                            <div key={idx} className="py-2 flex items-center justify-between gap-2">
                              <span className="font-semibold text-rose-700 dark:text-rose-300">{item.dep}</span>
                              <span className="text-[10px] text-zinc-400 truncate max-w-[180px]" title={item.file}>{item.file.split("/").pop()}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Limitations Note */}
              {comparison.limitations.length > 0 && (
                <section className="rounded-xl bg-zinc-100/80 p-4 dark:bg-zinc-900/50 text-[11px]">
                  <h3 className="font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400 font-mono">{isPt ? "Limitações da Análise AST" : "AST Analysis Limitations"}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-zinc-500">
                    {comparison.limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
