import React from "react";
import { Search, Globe, FolderGit2, X, RefreshCw } from "lucide-react";

export type ProjectsSearchTab = "my_projects" | "discover_public";

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
}: ProjectsSearchBarProps) {
  const isPt = language === "pt";

  const defaultPlaceholder =
    activeTab === "my_projects"
      ? isPt
        ? "Filtrar por nome, repositório ou tecnologia..."
        : "Filter by name, repository or framework..."
      : isPt
      ? "Pesquisar qualquer repositório público (ex: torvalds/linux, tailwind, next.js)..."
      : "Search any public repository (e.g. torvalds/linux, tailwind, next.js)...";

  return (
    <div className="space-y-3">
      {/* Tab toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-zinc-100 dark:bg-zinc-850 rounded-xl text-xs font-medium self-start sm:self-auto border border-zinc-200/60 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => onTabChange("my_projects")}
            className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "my_projects"
                ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>{isPt ? "Meus Projetos" : "My Projects"}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200/70 dark:bg-zinc-800 opacity-80">
              {myProjectsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange("discover_public")}
            className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "discover_public"
                ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{isPt ? "Descobrir Repositórios Públicos" : "Discover Public Repos"}</span>
            {activeTab === "discover_public" && publicResultsCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200/70 dark:bg-zinc-800 opacity-80">
                {publicResultsCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === "discover_public" && (
          <span className="text-[11px] text-zinc-400 font-mono">
            {isPt ? "GitHub API Search • Ordenado por Estrelas" : "GitHub API Search • Sorted by Stars"}
          </span>
        )}
      </div>

      {/* Input row */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-zinc-400 pointer-events-none">
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSearchSubmit) {
              e.preventDefault();
              onSearchSubmit();
            }
          }}
          placeholder={placeholder || defaultPlaceholder}
          className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-zinc-100/20 transition-all shadow-xs"
        />

        <div className="absolute right-2 flex items-center space-x-1.5">
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition-colors cursor-pointer"
              title={isPt ? "Limpar" : "Clear"}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {activeTab === "discover_public" && (
            <button
              type="button"
              onClick={onSearchSubmit}
              disabled={isLoading || !searchQuery.trim()}
              className="px-2.5 py-1 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-[11px] font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer shrink-0"
            >
              {isPt ? "Buscar" : "Search"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
