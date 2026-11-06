import React, { useEffect, useState } from "react";
import { ArrowLeftRight, GitBranch, Loader2, RefreshCw } from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { authenticatedHeaders } from "../lib/api";

interface ArchitectureFileChange {
  path: string;
  status: "added" | "removed" | "modified";
  certainty: "KNOWN" | "INFERRED" | "UNKNOWN";
  symbols: { added: Array<{ name: string; type: string }>; removed: Array<{ name: string; type: string }>; modified: Array<{ before?: { name: string }; after?: { name: string } }> };
  dependencies: { added: string[]; removed: string[] };
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

export function ArchitectureComparePage() {
  const { currentProject } = useProject();
  const { language } = useLanguage();
  const isPt = language === "pt";
  const [branches, setBranches] = useState<string[]>([]);
  const [base, setBase] = useState("");
  const [head, setHead] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ArchitectureComparison | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!currentProject?.id) { setBranches([]); return; }
      setLoadingBranches(true);
      setError(null);
      try {
        const response = await fetch(`/api/repository/branches?projectId=${encodeURIComponent(currentProject.id)}&per_page=100`, {
          credentials: "include",
          headers: await authenticatedHeaders(),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load repository branches.");
        const names = Array.isArray(payload.branches)
          ? payload.branches.map((item: any) => item?.name).filter((name: unknown): name is string => typeof name === "string")
          : [];
        if (cancelled) return;
        setBranches(names);
        const defaultRef = currentProject.defaultBranch || currentProject.branch || names[0] || "";
        setBase((current) => current && names.includes(current) ? current : defaultRef);
        setHead((current) => current && names.includes(current) && current !== defaultRef ? current : (names.find((name: string) => name !== defaultRef) || defaultRef));
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Could not load branches.");
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [currentProject?.id]);

  const runComparison = async () => {
    if (!currentProject?.id || !base || !head || base === head) return;
    setComparing(true);
    setError(null);
    setComparison(null);
    try {
      const response = await fetch("/api/repository/compare-architecture", {
        method: "POST",
        credentials: "include",
        headers: await authenticatedHeaders({}, true),
        body: JSON.stringify({ projectId: currentProject.id, base, head }),
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

  const selectClass = "w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";
  const summaryLabels: Record<string, string> = isPt ? {
    filesChanged: "Arquivos alterados", filesAdded: "Adicionados", filesRemoved: "Removidos",
    filesModified: "Modificados", symbolsAdded: "Símbolos adicionados", symbolsRemoved: "Símbolos removidos",
    dependenciesAdded: "Dependências adicionadas", dependenciesRemoved: "Dependências removidas",
  } : {
    filesChanged: "Files changed", filesAdded: "Added", filesRemoved: "Removed",
    filesModified: "Modified", symbolsAdded: "Symbols added", symbolsRemoved: "Symbols removed",
    dependenciesAdded: "Dependencies added", dependenciesRemoved: "Dependencies removed",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
      <header className="border-b border-zinc-200/80 pb-5 dark:border-zinc-800">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
          <GitBranch className="h-3.5 w-3.5" /> AFTER / ARCHITECTURE COMPARATOR
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{isPt ? "Comparador de Arquitetura" : "Architecture Comparator"}</h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{currentProject?.repository || (isPt ? "Selecione um projeto para comparar branches." : "Select a project to compare branches.")}</p>
      </header>

      {!currentProject ? (
        <p className="rounded-lg border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800">{isPt ? "Nenhum projeto selecionado." : "No project selected."}</p>
      ) : (
        <>
          <section className="grid grid-cols-1 items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-[1fr_auto_1fr_auto]">
            <label className="space-y-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {isPt ? "Branch base" : "Base branch"}
              <select value={base} onChange={(e) => setBase(e.target.value)} className={selectClass} disabled={loadingBranches}>
                {branches.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <ArrowLeftRight className="mx-auto mb-2 h-4 w-4 text-zinc-400" />
            <label className="space-y-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {isPt ? "Branch de comparação" : "Compare branch"}
              <select value={head} onChange={(e) => setHead(e.target.value)} className={selectClass} disabled={loadingBranches}>
                {branches.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void runComparison()} disabled={comparing || loadingBranches || !base || !head || base === head}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
              {comparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {isPt ? "Comparar arquitetura" : "Compare architecture"}
            </button>
          </section>
          {loadingBranches && <p className="text-xs text-zinc-500">{isPt ? "Carregando branches..." : "Loading branches..."}</p>}
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

          {comparison && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500"><span className="font-mono text-zinc-800 dark:text-zinc-200">{comparison.base.ref}</span> → <span className="font-mono text-zinc-800 dark:text-zinc-200">{comparison.head.ref}</span></p>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{comparison.completeness === "partial" ? (isPt ? "Análise parcial" : "Partial analysis") : (isPt ? "Análise limitada" : "Bounded analysis")}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(comparison.summary).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="font-mono text-2xl tabular-nums text-zinc-950 dark:text-zinc-50">{value}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{summaryLabels[key] || key}</p>
                  </div>
                ))}
              </div>
              <section className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{isPt ? "Alterações arquiteturais por arquivo" : "Architectural changes by file"}</h2>
                  <p className="mt-1 text-[10px] text-zinc-500">{comparison.sourceFilesAnalyzed}/{comparison.sourceFilesConsidered} {isPt ? "arquivos de código analisados" : "source files analyzed"}</p>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {comparison.files.length === 0 && <p className="p-5 text-xs text-zinc-500">{isPt ? "Nenhuma diferença de arquivo encontrada." : "No file differences found."}</p>}
                  {comparison.files.map((file) => (
                    <article key={file.path} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[9px] font-mono uppercase tracking-widest ${file.status === "added" ? "text-emerald-600" : file.status === "removed" ? "text-red-600" : "text-amber-600"}`}>{file.status}</span>
                        <span className="break-all font-mono text-xs text-zinc-800 dark:text-zinc-200">{file.path}</span>
                        <span className="ml-auto text-[9px] text-zinc-400">{file.certainty}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
                        <span>+{file.symbols.added.length} {isPt ? "símbolos" : "symbols"}</span>
                        <span>-{file.symbols.removed.length} {isPt ? "símbolos" : "symbols"}</span>
                        <span>+{file.dependencies.added.length} {isPt ? "dependências" : "dependencies"}</span>
                        <span>-{file.dependencies.removed.length} {isPt ? "dependências" : "dependencies"}</span>
                      </div>
                      {(file.symbols.added.length + file.symbols.removed.length + file.dependencies.added.length + file.dependencies.removed.length > 0) && (
                        <div className="grid gap-2 text-[10px] sm:grid-cols-2">
                          <div>{file.symbols.added.map((symbol) => <p key={symbol.name} className="text-emerald-700 dark:text-emerald-400">+ {symbol.type} {symbol.name}</p>)}{file.dependencies.added.map((dep) => <p key={dep} className="text-emerald-700 dark:text-emerald-400">+ import {dep}</p>)}</div>
                          <div>{file.symbols.removed.map((symbol) => <p key={symbol.name} className="text-red-700 dark:text-red-400">− {symbol.type} {symbol.name}</p>)}{file.dependencies.removed.map((dep) => <p key={dep} className="text-red-700 dark:text-red-400">− import {dep}</p>)}</div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
              {comparison.limitations.length > 0 && <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900"><h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">{isPt ? "Limitações da análise" : "Analysis limitations"}</h3><ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-zinc-500">{comparison.limitations.map((item) => <li key={item}>{item}</li>)}</ul></section>}
              <p className="text-right text-[10px] text-zinc-400">{isPt ? "Gerado em " : "Generated "}{new Date(comparison.generatedAt).toLocaleString(isPt ? "pt-BR" : "en-US")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
