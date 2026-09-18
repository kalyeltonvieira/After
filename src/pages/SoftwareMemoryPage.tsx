import React, { useMemo, useState } from "react";
import { Brain, ChevronRight, FileCode, GitCommit, GitPullRequest, CircleDot, Tag, Lightbulb, Search, Sparkles } from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { KnowledgeBadge } from "../components/StatusBadge";

function iconForType(type: string) {
  switch (type) {
    case "commit": return GitCommit;
    case "pull_request": return GitPullRequest;
    case "issue": return CircleDot;
    case "release": return Tag;
    case "dependency": return FileCode;
    case "decision": return Lightbulb;
    default: return Brain;
  }
}

export function SoftwareMemoryPage() {
  const { currentProject, memoryEntries, setAiContext, setIsAskAfterOpen } = useProject();
  const { language } = useLanguage();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return memoryEntries.filter((entry) => {
      const matchesType = type === "all" || entry.type === type;
      const haystack = [
        entry.title,
        entry.summary,
        ...(entry.evidence || []),
        ...(entry.relatedFiles || []),
      ].join(" ").toLowerCase();
      return matchesType && (!q || haystack.includes(q));
    });
  }, [memoryEntries, search, type]);

  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto rounded-3xl border border-zinc-200 dark:border-zinc-800 p-10 text-center">
          <Brain className="w-8 h-8 mx-auto text-zinc-400" />
          <h1 className="mt-4 text-lg font-semibold">
            {language === "pt" ? "A Memória começa com um projeto" : "Memory starts with a project"}
          </h1>
          <p className="mt-2 text-xs text-zinc-500">
            {language === "pt"
              ? "Conecte um repositório para o AFTER começar a acumular evidências sobre sua evolução."
              : "Connect a repository so AFTER can accumulate evidence about its evolution."}
          </p>
        </div>
      </div>
    );
  }

  const types = ["all", ...new Set(memoryEntries.map((entry) => entry.type))];

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6">
      <header className="border-b border-zinc-200/70 dark:border-zinc-800 pb-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-400 font-mono">
              <span>SOFTWARE MEMORY</span>
              <span>•</span>
              <span className="normal-case tracking-normal">{currentProject.repository}</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
              {language === "pt" ? "Memória do Software" : "Software Memory"}
            </h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-2xl">
              {language === "pt"
                ? "Um ledger persistente do que o repositório realmente revelou ao longo do tempo."
                : "A persistent ledger of what the repository has actually revealed over time."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAiContext({ type: "repository", label: currentProject.repository });
              setIsAskAfterOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ask AFTER
          </button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === "pt" ? "Buscar na memória…" : "Search memory…"}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {types.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setType(item)}
              className={`px-3 py-2 rounded-xl text-[11px] font-medium whitespace-nowrap cursor-pointer ${type === item ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {memoryEntries.length === 0 ? (
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <Brain className="w-8 h-8 mx-auto text-zinc-400" />
          <h2 className="mt-4 text-sm font-semibold">
            {language === "pt" ? "Nenhuma memória registrada ainda" : "No memory recorded yet"}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {language === "pt"
              ? "Memórias surgem a partir de commits e outros fatos observados no repositório."
              : "Memory entries appear from commits and other observed repository facts."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-500">
          {language === "pt" ? "Nenhuma memória corresponde ao filtro." : "No memory entries match the filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const Icon = iconForType(entry.type);
            return (
              <article
                key={entry.id}
                className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-zinc-500" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold truncate">{entry.title}</h2>
                      <KnowledgeBadge status={entry.status} />
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono">
                        {entry.type}
                      </span>
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {entry.summary}
                    </p>

                    {entry.evidence?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {entry.evidence.slice(0, 8).map((item, index) => (
                          <span key={index} className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-zinc-400">
                      <span>{new Date(entry.createdAt).toLocaleString(language === "pt" ? "pt-BR" : "en-US")}</span>
                      {entry.source?.url && (
                        <a href={entry.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-200">
                          {language === "pt" ? "Abrir fonte" : "Open source"} <ChevronRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
