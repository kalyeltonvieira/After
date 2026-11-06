import React, { useState, useEffect } from "react";
import {
  FolderGit2,
  Plus,
  GitBranch,
  Code2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Globe,
  Star,
  GitFork,
  RefreshCw,
  Search,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { ProjectStatistics } from "../components/ProjectStatistics";
import { ProjectsSearchBar, ProjectsSearchTab, DiscoveryFilters } from "../components/ProjectsSearchBar";
import { searchPublicRepositories, GitHubRepositoryItem } from "../services/githubService";

interface ProjectsPageProps {
  onOpenCreateProject: () => void;
  onNavigate: (view: string) => void;
}

export function ProjectsPage({ onOpenCreateProject, onNavigate }: ProjectsPageProps) {
  const { projects, currentProject, setCurrentProject, connectRepository } = useProject();
  const { language } = useLanguage();
  const isPt = language === "pt";

  // Tab & Search state
  const [activeTab, setActiveTab] = useState<ProjectsSearchTab>("my_projects");
  const [searchQuery, setSearchQuery] = useState("");

  // Public search state
  const [publicRepos, setPublicRepos] = useState<GitHubRepositoryItem[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [publicSearchError, setPublicSearchError] = useState<string | null>(null);
  const [connectingRepo, setConnectingRepo] = useState<string | null>(null);
  const [discoveryFilters, setDiscoveryFilters] = useState<DiscoveryFilters>({ minimumStars: 0, language: "", license: "", sort: "stars" });

  // Filter My Projects locally
  const filteredMyProjects = projects.filter((proj) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      proj.name.toLowerCase().includes(q) ||
      proj.repository.toLowerCase().includes(q) ||
      (proj.description || "").toLowerCase().includes(q) ||
      (proj.framework || "").toLowerCase().includes(q) ||
      (proj.language || "").toLowerCase().includes(q)
    );
  });

  // Debounced public discovery. Filter changes are translated into GitHub search qualifiers.
  useEffect(() => {
    if (activeTab !== "discover_public") return;
    const queryText = searchQuery.trim() || "react";
    if (searchQuery.trim().length === 1) return;
    const timer = window.setTimeout(() => {
      void fetchPublicRepos(queryText);
    }, searchQuery.trim() ? 400 : 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery, activeTab, discoveryFilters.minimumStars, discoveryFilters.language, discoveryFilters.license, discoveryFilters.sort]);

  const fetchPublicRepos = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setLoadingPublic(true);
    setPublicSearchError(null);
    try {
      const res = await searchPublicRepositories(q, {
        per_page: 24,
        sort: discoveryFilters.sort,
        minimumStars: discoveryFilters.minimumStars,
        ...(discoveryFilters.language ? { language: discoveryFilters.language } : {}),
        ...(discoveryFilters.license ? { license: discoveryFilters.license } : {}),
      });
      setPublicRepos(res.items || []);
    } catch (err: any) {
      setPublicSearchError(err?.message || (isPt ? "Erro ao buscar repositórios no GitHub." : "Error searching GitHub repositories."));
    } finally {
      setLoadingPublic(false);
    }
  };

  const handleConnectPublicRepo = async (repo: GitHubRepositoryItem) => {
    setConnectingRepo(repo.full_name);
    try {
      await connectRepository({
        repository: repo.full_name,
        branch: repo.default_branch || "main",
      });
      setActiveTab("my_projects");
      setSearchQuery("");
      onNavigate("overview");
    } catch (err: any) {
      setPublicSearchError(err?.message || (isPt ? "Falha ao conectar repositório." : "Failed to connect repository."));
    } finally {
      setConnectingRepo(null);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/70 dark:border-zinc-850">
        <div>
          <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono mb-1">
            <span>{isPt ? "DIRETÓRIO DE PROJETOS" : "PROJECT DIRECTORY"}</span>
            <span>•</span>
            <span>{projects.length} {isPt ? "conectado(s)" : "connected"}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {isPt ? "Projetos e Repositórios" : "Projects & Repositories"}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {isPt
              ? "Monitore a arquitetura dos seus softwares ou descubra repositórios públicos para rastreamento no AFTER."
              : "Monitor your software architecture or discover public repositories for continuous observation in AFTER."}
          </p>
        </div>

        <button
          id="projects-create-new-btn"
          type="button"
          onClick={onOpenCreateProject}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isPt ? "Conectar Novo Projeto" : "Connect New Project"}</span>
        </button>
      </div>

      {/* Highlighted Project Statistics for Currently Selected Project (only in My Projects) */}
      {activeTab === "my_projects" && currentProject && projects.length > 0 && !searchQuery && (
        <ProjectStatistics onNavigate={onNavigate} />
      )}

      {/* Unified Search & Mode Switcher Bar */}
      <ProjectsSearchBar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSearchQuery("");
          setPublicSearchError(null);
          if (tab === "discover_public" && publicRepos.length === 0) {
            void fetchPublicRepos("react");
          }
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => {
          if (activeTab === "discover_public") {
            void fetchPublicRepos(searchQuery);
          }
        }}
        isLoading={loadingPublic}
        myProjectsCount={projects.length}
        publicResultsCount={publicRepos.length}
        language={language}
        discoveryFilters={discoveryFilters}
        onDiscoveryFiltersChange={setDiscoveryFilters}
      />

      {/* Error Banner */}
      {publicSearchError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
          <span>{publicSearchError}</span>
          <button
            type="button"
            onClick={() => setPublicSearchError(null)}
            className="text-[11px] underline ml-2 cursor-pointer"
          >
            {isPt ? "Dispensar" : "Dismiss"}
          </button>
        </div>
      )}

      {/* TAB 1: MY PROJECTS */}
      {activeTab === "my_projects" && (
        <>
          {projects.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-4 max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                <FolderGit2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {isPt ? "Nenhum projeto conectado ainda" : "No projects connected yet"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
                {isPt
                  ? "Conecte um repositório GitHub para iniciar o rastreamento de dependências, drift arquitetural e racional institucional."
                  : "Connect a GitHub repository to begin tracking dependencies, architectural drift, and institutional rationale."}
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onOpenCreateProject}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isPt ? "Conectar Primeiro Projeto" : "Connect First Project"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("discover_public");
                    void fetchPublicRepos("react");
                  }}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-zinc-250 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{isPt ? "Explorar Repos Públicos" : "Explore Public Repos"}</span>
                </button>
              </div>
            </div>
          ) : filteredMyProjects.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-3">
              <Search className="w-8 h-8 text-zinc-400 mx-auto opacity-60" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {isPt ? "Nenhum projeto correspondente" : "No matching projects"}
              </h3>
              <p className="text-xs text-zinc-400">
                {isPt
                  ? `Nenhum dos seus projetos monitorados corresponde a "${searchQuery}".`
                  : `None of your monitored projects match "${searchQuery}".`}
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs text-zinc-900 dark:text-zinc-100 font-semibold underline cursor-pointer pt-1"
              >
                {isPt ? "Limpar busca" : "Clear filter"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMyProjects.map((proj) => {
                const isSelected = currentProject?.id === proj.id;
                return (
                  <div
                    key={proj.id}
                    className={`p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-5 ${
                      isSelected
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50/50 dark:bg-zinc-900/60 shadow-xs ring-1 ring-zinc-900/10 dark:ring-zinc-100/10"
                        : "border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <FolderGit2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-[240px]">
                            {proj.repository}
                          </span>
                        </div>
                        {isSelected ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[10px] font-mono uppercase tracking-wider shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{isPt ? "Ativo" : "Active"}</span>
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                          {proj.name}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                          {proj.description || (isPt ? "Rastreamento contínuo de evolução de software ativo." : "Continuous software evolution tracking active.")}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 font-mono pt-1">
                        <span className="flex items-center space-x-1">
                          <GitBranch className="w-3 h-3" />
                          <span>{proj.branch}</span>
                        </span>
                        {proj.framework && (
                          <span className="flex items-center space-x-1">
                            <Code2 className="w-3 h-3" />
                            <span>{proj.framework}</span>
                          </span>
                        )}
                        {proj.language && <span>{proj.language}</span>}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {isPt ? "Criado em " : "Created "}
                        {new Date(proj.createdAt).toLocaleDateString(isPt ? "pt-BR" : "en-US")}
                      </span>

                      {isSelected ? (
                        <button
                          type="button"
                          onClick={() => onNavigate("overview")}
                          className="inline-flex items-center space-x-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                        >
                          <span>{isPt ? "Abrir Visão Geral" : "Open Overview"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentProject(proj);
                            onNavigate("overview");
                          }}
                          className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          {isPt ? "Alternar para este projeto" : "Switch to this project"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: DISCOVER PUBLIC REPOSITORIES */}
      {activeTab === "discover_public" && (
        <div className="space-y-4">
          {loadingPublic ? (
            <div className="p-16 text-center rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-zinc-500 mx-auto" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {isPt ? "Consultando repositórios no GitHub..." : "Querying repositories on GitHub..."}
              </h3>
              <p className="text-xs text-zinc-400">
                {isPt ? "Buscando repositórios públicos e metadados oficiais." : "Fetching public repositories and official metadata."}
              </p>
            </div>
          ) : publicRepos.length === 0 ? (
            <div className="p-16 text-center rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-3">
              <Globe className="w-8 h-8 text-zinc-400 mx-auto opacity-60" />
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {isPt ? "Nenhum repositório público encontrado" : "No public repositories found"}
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {isPt
                  ? "Tente buscar por tecnologias, linguagens ou nomes de projetos conhecidos (ex: 'vue', 'fastapi', 'prisma')."
                  : "Try searching for technologies, languages, or popular project names (e.g. 'vue', 'fastapi', 'prisma')."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicRepos.map((repo) => {
                const isAlreadyConnected = projects.some(
                  (p) => p.repository.toLowerCase() === repo.full_name.toLowerCase()
                );
                const isConnectingThis = connectingRepo === repo.full_name;

                return (
                  <div
                    key={repo.id}
                    className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4 shadow-xs"
                  >
                    <div className="space-y-2.5">
                      {/* Top bar: Owner avatar, repo name, link */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2 truncate">
                          {repo.owner?.avatar_url ? (
                            <img
                              src={repo.owner.avatar_url}
                              alt={repo.owner.login}
                              className="w-5 h-5 rounded-full border border-zinc-200 dark:border-zinc-700 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Globe className="w-4 h-4 text-zinc-400 shrink-0" />
                          )}
                          <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {repo.full_name}
                          </span>
                        </div>

                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-1"
                          title={isPt ? "Ver no GitHub" : "View on GitHub"}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-zinc-600 dark:text-zinc-350 line-clamp-2 leading-relaxed min-h-[32px]">
                        {repo.description || (isPt ? "Sem descrição fornecida no GitHub." : "No description provided on GitHub.")}
                      </p>

                      {/* Metadata badges: Stars, Forks, Language */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        {repo.language && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-700/60 font-sans font-medium text-zinc-700 dark:text-zinc-300">
                            {repo.language}
                          </span>
                        )}

                        <span className="flex items-center space-x-1 text-amber-500 font-medium">
                          <Star className="w-3 h-3 fill-current" />
                          <span>
                            {repo.stargazers_count >= 1000
                              ? `${(repo.stargazers_count / 1000).toFixed(1)}k`
                              : repo.stargazers_count}
                          </span>
                        </span>

                        {repo.forks_count > 0 && (
                          <span className="flex items-center space-x-1 text-zinc-400">
                            <GitFork className="w-3 h-3" />
                            <span>
                              {repo.forks_count >= 1000
                                ? `${(repo.forks_count / 1000).toFixed(1)}k`
                                : repo.forks_count}
                            </span>
                          </span>
                        )}

                        <span className="flex items-center space-x-1 text-zinc-400">
                          <GitBranch className="w-3 h-3" />
                          <span>{repo.default_branch || "main"}</span>
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action: Connect to AFTER platform */}
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-850 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {isPt ? "Público" : "Public"}
                      </span>

                      {isAlreadyConnected ? (
                        <span className="inline-flex items-center space-x-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isPt ? "Já Conectado" : "Connected"}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleConnectPublicRepo(repo)}
                          disabled={isConnectingThis}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer shadow-xs"
                        >
                          {isConnectingThis ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>{isPt ? "Conectando…" : "Connecting…"}</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isPt ? "Conectar ao AFTER" : "Connect to AFTER"}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
