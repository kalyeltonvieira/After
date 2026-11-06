import React from "react";
import { motion } from "motion/react";
import { Search, Globe, FolderGit2, X, RefreshCw } from "lucide-react";

export type ProjectsSearchTab = "my_projects" | "discover_public";
export interface DiscoveryFilters {
  minimumStars: number;
  language: string;
  license: string;
  topic?: string;
  sort: "stars" | "forks" | "updated";
}

interface ProjectsSearchBarProps {
  activeTab: ProjectsSearchTab;
  onTabChange: (tab: ProjectsSearchTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: () => void;
  isLoading?: boolean;
  myProjectsCount?: number;
  publicResultsCount?: number;
  placeholder?: string;
  language?: string;
  discoveryFilters: DiscoveryFilters;
  onDiscoveryFiltersChange: (filters: DiscoveryFilters) => void;
}

export function ProjectsSearchBar({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  isLoading = false,
  myProjectsCount = 0,
  publicResultsCount = 0,
  placeholder,
  language = "en",
  discoveryFilters,
  onDiscoveryFiltersChange,
}: ProjectsSearchBarProps) {
  const isPt = language === "pt";
  const defaultPlaceholder = activeTab === "my_projects"
    ? (isPt ? "Filtrar por nome, repositório ou tecnologia..." : "Filter by name, repository or framework...")
    : (isPt ? "Pesquisar repositórios públicos no GitHub..." : "Search public GitHub repositories...");

  const inputClass = "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-2 text-[11px] text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10";

  const updateFilter = <K extends keyof DiscoveryFilters>(key: K, value: DiscoveryFilters[K]) => {
    onDiscoveryFiltersChange({ ...discoveryFilters, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-xs font-medium self-start sm:self-auto border border-zinc-200/70 dark:border-zinc-800 relative">
          <button type="button" onClick={() => onTabChange("my_projects")}
            className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-md transition-colors cursor-pointer ${activeTab === "my_projects" ? "text-zinc-950 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
            {activeTab === "my_projects" && <motion.span layoutId="projects-search-active-tab" className="absolute inset-0 rounded-md bg-white dark:bg-zinc-800 shadow-sm" transition={{ type: "spring", stiffness: 440, damping: 36 }} />}
            <FolderGit2 className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">{isPt ? "Meus Projetos" : "My Projects"}</span>
            <span className="relative z-10 text-[10px] font-mono text-zinc-400">{myProjectsCount}</span>
          </button>
          <button type="button" onClick={() => onTabChange("discover_public")}
            className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-md transition-colors cursor-pointer ${activeTab === "discover_public" ? "text-zinc-950 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
            {activeTab === "discover_public" && <motion.span layoutId="projects-search-active-tab" className="absolute inset-0 rounded-md bg-white dark:bg-zinc-800 shadow-sm" transition={{ type: "spring", stiffness: 440, damping: 36 }} />}
            <Globe className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">{isPt ? "Descobrir Públicos" : "Discover Public"}</span>
            {activeTab === "discover_public" && publicResultsCount > 0 && <span className="relative z-10 text-[10px] font-mono text-zinc-400">{publicResultsCount}</span>}
          </button>
        </div>
        {activeTab === "discover_public" && (
          <span className="text-[10px] text-zinc-400 font-mono">{isPt ? "Filtros aplicados diretamente na busca do GitHub" : "Filters applied directly to GitHub search"}</span>
        )}
      </div>

      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-zinc-400 pointer-events-none">
          {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </div>
        <input
          type="text" value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && onSearchSubmit) { e.preventDefault(); onSearchSubmit(); } }}
          placeholder={placeholder || defaultPlaceholder}
          className="w-full pl-10 pr-24 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10"
        />
        <div className="absolute right-2 flex items-center gap-1.5">
          {searchQuery && <button type="button" onClick={() => onSearchChange("")} className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer" title={isPt ? "Limpar" : "Clear"}><X className="w-3.5 h-3.5" /></button>}
          {activeTab === "discover_public" && <button type="button" onClick={onSearchSubmit} disabled={isLoading || !searchQuery.trim()} className="px-2.5 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-md text-[11px] font-semibold disabled:opacity-40 cursor-pointer">{isPt ? "Buscar" : "Search"}</button>}
        </div>
      </div>

      {activeTab === "discover_public" && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <label className="flex flex-col gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            {isPt ? "Estrelas mínimas" : "Minimum stars"}
            <select aria-label={isPt ? "Estrelas mínimas" : "Minimum stars"} value={String(discoveryFilters.minimumStars)} onChange={(e) => updateFilter("minimumStars", Number(e.target.value))} className={inputClass}>
              <option value="0">{isPt ? "Qualquer" : "Any"}</option><option value="1000">1,000+</option><option value="5000">5,000+</option><option value="20000">20,000+</option><option value="50000">50,000+</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            {isPt ? "Linguagem" : "Language"}
            <select aria-label={isPt ? "Linguagem" : "Language"} value={discoveryFilters.language} onChange={(e) => updateFilter("language", e.target.value)} className={inputClass}>
              <option value="">{isPt ? "Todas" : "All"}</option><option>TypeScript</option><option>JavaScript</option><option>Python</option><option>Go</option><option>Rust</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            {isPt ? "Tópico / Tag" : "Topic / Tag"}
            <select aria-label={isPt ? "Tópico / Tag" : "Topic / Tag"} value={discoveryFilters.topic || ""} onChange={(e) => updateFilter("topic", e.target.value)} className={inputClass}>
              <option value="">{isPt ? "Todos" : "All"}</option><option value="ai">AI / LLM</option><option value="react">React</option><option value="devtools">DevTools</option><option value="database">Database</option><option value="cli">CLI</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            {isPt ? "Licença" : "License"}
            <select aria-label={isPt ? "Licença" : "License"} value={discoveryFilters.license} onChange={(e) => updateFilter("license", e.target.value)} className={inputClass}>
              <option value="">{isPt ? "Todas" : "All"}</option><option value="mit">MIT</option><option value="apache-2.0">Apache 2.0</option><option value="gpl-3.0">GPL 3.0</option><option value="bsd-3-clause">BSD 3-Clause</option><option value="mpl-2.0">MPL 2.0</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            {isPt ? "Ordenar por" : "Sort by"}
            <select aria-label={isPt ? "Ordenar por" : "Sort by"} value={discoveryFilters.sort} onChange={(e) => updateFilter("sort", e.target.value as DiscoveryFilters["sort"])} className={inputClass}>
              <option value="stars">{isPt ? "Estrelas" : "Stars"}</option><option value="forks">{isPt ? "Forks" : "Forks"}</option><option value="updated">{isPt ? "Atualização" : "Recently updated"}</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
