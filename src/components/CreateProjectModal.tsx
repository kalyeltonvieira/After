import React, { useState, useEffect } from "react";
import {
  X,
  GitBranch,
  Github,
  Code2,
  FolderPlus,
  ArrowRight,
  ShieldCheck,
  Lock,
  Globe,
  Star,
  CheckCircle2,
  RefreshCw,
  Search,
  AlertCircle,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  getConnectedGitHubUser,
  listUserRepositories,
  searchPublicRepositories,
  validateRepositoryInput,
  sanitizeGitHubRepo,
  GitHubUser,
  GitHubRepositoryItem,
} from "../services/githubService";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const { connectRepository, createProject } = useProject();
  const { user: firebaseUser, refreshGitHubSession } = useAuth();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<"github" | "manual">("github");

  // GitHub connection fields
  const [repoInput, setRepoInput] = useState("");
  const [repoBranch, setRepoBranch] = useState("");

  const trimmedRepoInput = repoInput.trim();
  const repoValidation = trimmedRepoInput ? validateRepositoryInput(trimmedRepoInput, language as "en" | "pt") : null;
  const isInvalid = Boolean(trimmedRepoInput && repoValidation && !repoValidation.isValid);
  const isValid = Boolean(trimmedRepoInput && repoValidation && repoValidation.isValid);

  // GitHub User & Repositories state
  const [connectedUser, setConnectedUser] = useState<GitHubUser | null>(null);
  const [userRepos, setUserRepos] = useState<GitHubRepositoryItem[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [repoSourceMode, setRepoSourceMode] = useState<"user" | "public">("user");
  const [publicSearchQuery, setPublicSearchQuery] = useState("");
  const [publicSearchResults, setPublicSearchResults] = useState<GitHubRepositoryItem[]>([]);
  const [searchingPublic, setSearchingPublic] = useState(false);

  const filteredRepos = userRepos.filter((repo) => {
    const q = repoSearch.trim().toLowerCase();
    return !q || repo.full_name.toLowerCase().includes(q) || (repo.description || "").toLowerCase().includes(q);
  });
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Manual project fields
  const [manualName, setManualName] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualFramework, setManualFramework] = useState("React & TypeScript");
  const [manualLanguage, setManualLanguage] = useState("TypeScript");

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Instant preview of GitHub user identity from Firebase session
  useEffect(() => {
    if (!connectedUser && firebaseUser?.photoURL) {
      setConnectedUser({
        id: 0,
        login: firebaseUser.displayName || "github-user",
        name: firebaseUser.displayName || null,
        email: firebaseUser.email || null,
        avatar_url: firebaseUser.photoURL,
        html_url: `https://github.com/${firebaseUser.displayName || ""}`,
        public_repos: 0,
      });
    }
  }, [firebaseUser, connectedUser]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    void loadGitHubUserData(false);
  }, [isOpen]);

  const loadGitHubUserData = async (forceFresh = false) => {
    setLoadingRepos(true);
    setError(null);
    setNeedsReconnect(false);

    try {
      const [ghUser, repos] = await Promise.all([
        getConnectedGitHubUser(forceFresh),
        listUserRepositories(forceFresh),
      ]);
      setConnectedUser(ghUser);
      setUserRepos(repos);
      setNeedsReconnect(false);
    } catch (firstError: any) {
      const message = String(firstError?.message || "");
      const isAuthIssue = /Connect GitHub first|Invalid or expired|unauthorized|401/i.test(message);

      if (isAuthIssue) {
        setNeedsReconnect(true);
        setError(
          language === "pt"
            ? "A autorização do GitHub precisa ser renovada para listar repositórios privados."
            : "GitHub authorization must be refreshed to list your repositories."
        );
      } else {
        setConnectedUser(null);
        setUserRepos([]);
        setError(message || "Não foi possível carregar seus repositórios do GitHub.");
      }
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleManualReconnect = async () => {
    try {
      setLoadingRepos(true);
      setError(null);
      await refreshGitHubSession();
      await loadGitHubUserData(true);
    } catch (err: any) {
      setError(err?.message || (language === "pt" ? "Falha ao renovar conexão GitHub." : "Failed to renew GitHub connection."));
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleSelectRepo = (repo: GitHubRepositoryItem) => {
    setRepoInput(repo.full_name);
    setRepoBranch(repo.default_branch || "main");
    setError(null);
  };

  const handleSearchPublicRepos = async (queryText: string) => {
    const q = queryText.trim();
    if (!q || q.length < 2) {
      setPublicSearchResults([]);
      return;
    }

    setSearchingPublic(true);
    try {
      const res = await searchPublicRepositories(q, { per_page: 25, sort: "stars" });
      setPublicSearchResults(res.items || []);
    } catch (searchErr: any) {
      console.warn("Public repository search failed:", searchErr?.message);
    } finally {
      setSearchingPublic(false);
    }
  };

  const handleConnectGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = sanitizeGitHubRepo(repoInput);
    if (!sanitized) {
      const validation = validateRepositoryInput(repoInput, language as "en" | "pt");
      setError(
        validation.error ||
          (language === "pt"
            ? "Formato de repositório inválido. Use 'proprietário/repositório' ou URL do GitHub."
            : "Invalid repository format. Please enter 'owner/repo' or full GitHub URL.")
      );
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingStep(
      language === "pt"
        ? "Consultando metadados e branches no GitHub..."
        : "Querying repository metadata and branches..."
    );

    try {
      setLoadingStep(
        language === "pt"
          ? "Analisando árvore de arquivos, dependências e arquitetura..."
          : "Parsing file tree, dependencies, and architecture nodes..."
      );
      await connectRepository({
        repository: sanitized,
        branch: repoBranch.trim() || undefined,
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || (language === "pt" ? "Falha ao conectar repositório" : "Failed to connect repository"));
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      setError("Please enter a project name");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createProject({
        name: manualName.trim(),
        description: manualDescription.trim(),
        repository: "unconnected",
        branch: "main",
        framework: manualFramework.trim(),
        language: manualLanguage.trim(),
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop: click to close */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 overflow-hidden">
        {/* Sticky Header with prominent close button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900">
          <div className="flex items-center space-x-2">
            <FolderPlus className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {language === "pt" ? "Conectar Projeto de Software" : "Connect Software Project"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar (Esc)"
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Tab selection */}
          <div className="flex space-x-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab("github");
                setError(null);
              }}
              className={`flex-1 py-2 font-medium rounded-lg transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === "github"
                  ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <Github className="w-3.5 h-3.5" />
              <span>{language === "pt" ? "GitHub" : "GitHub"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("manual");
                setError(null);
              }}
              className={`flex-1 py-2 font-medium rounded-lg transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === "manual"
                  ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{language === "pt" ? "Projeto Vazio" : "Empty Project"}</span>
            </button>

          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Tab 1: Connect GitHub */}
          {activeTab === "github" && (
            <form onSubmit={handleConnectGitHub} className="space-y-4">
            <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {needsReconnect ? (language === "pt" ? "GitHub (Reconexão Necessária)" : "GitHub (Reconnect Required)") : (language === "pt" ? "GitHub Conectado" : "GitHub Connected")}
                  </span>
                </div>
                {connectedUser && (
                  <div className="flex items-center space-x-2">
                    {connectedUser.avatar_url && (
                      <img
                        src={connectedUser.avatar_url}
                        alt={connectedUser.login}
                        className="w-5 h-5 rounded-full border border-zinc-200 dark:border-zinc-700"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      @{connectedUser.login}
                    </span>
                  </div>
                )}
              </div>

              {needsReconnect && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-400">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>
                      {language === "pt"
                        ? "Permissão do GitHub expirada ou incompleta."
                        : "GitHub permissions expired or incomplete."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualReconnect}
                    className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    {language === "pt" ? "Reconectar GitHub" : "Reconnect GitHub"}
                  </button>
                </div>
              )}

              <div className="space-y-3 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
                {/* Switcher: User repos vs Public GitHub search */}
                <div className="flex items-center gap-1 p-0.5 bg-zinc-200/70 dark:bg-zinc-800 rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => setRepoSourceMode("user")}
                    className={`flex-1 py-1 px-2 rounded-md font-medium transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      repoSourceMode === "user"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <span>{language === "pt" ? "Meus Repositórios" : "My Repositories"}</span>
                    <span className="text-[10px] opacity-75">({userRepos.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRepoSourceMode("public");
                      if (!publicSearchQuery && userRepos.length > 0) {
                        const defaultQuery = userRepos[0]?.language || "react";
                        setPublicSearchQuery(defaultQuery);
                        void handleSearchPublicRepos(defaultQuery);
                      }
                    }}
                    className={`flex-1 py-1 px-2 rounded-md font-medium transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      repoSourceMode === "public"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Search className="w-3 h-3" />
                    <span>{language === "pt" ? "Buscar Repos Públicos" : "Search Public Repos"}</span>
                  </button>
                </div>

                {repoSourceMode === "user" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        {language === "pt" ? "Repositórios da sua conta" : "Your account repositories"}
                      </span>
                      <button
                        type="button"
                        onClick={() => loadGitHubUserData(true)}
                        className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingRepos ? "animate-spin" : ""}`} />
                        <span>{language === "pt" ? "Atualizar" : "Refresh"}</span>
                      </button>
                    </div>

                    {userRepos.length > 0 ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <Search className="w-3 h-3 text-zinc-400" />
                          <input
                            value={repoSearch}
                            onChange={(e) => setRepoSearch(e.target.value)}
                            placeholder={language === "pt" ? "Filtrar seus repositórios…" : "Filter your repositories…"}
                            className="flex-1 bg-transparent text-[11px] outline-none border-b border-zinc-200 dark:border-zinc-700 py-1"
                          />
                          <span className="text-[10px] text-zinc-400">{filteredRepos.length}</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                          {filteredRepos.map((repo) => (
                            <button
                              key={repo.id}
                              type="button"
                              onClick={() => handleSelectRepo(repo)}
                              className={`w-full p-2 text-left rounded-lg text-xs flex items-center justify-between border transition-all cursor-pointer ${
                                repoInput === repo.full_name
                                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent shadow-xs"
                                  : "bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/60 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-200"
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                {repo.private ? <Lock className="w-3 h-3 text-amber-500 shrink-0" /> : <Globe className="w-3 h-3 text-zinc-400 shrink-0" />}
                                <span className="font-mono truncate">{repo.full_name}</span>
                              </div>
                              <div className="flex items-center space-x-2 shrink-0 text-[10px] opacity-70">
                                {repo.language && <span>{repo.language}</span>}
                                {repo.stargazers_count > 0 && (
                                  <span className="flex items-center space-x-0.5">
                                    <Star className="w-2.5 h-2.5 fill-current" />
                                    <span>{repo.stargazers_count}</span>
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-zinc-400">
                        {loadingRepos
                          ? (language === "pt" ? "Carregando seus repositórios..." : "Loading your repositories...")
                          : (language === "pt" ? "Nenhum repositório disponível para esta conta do GitHub." : "No repositories available for this GitHub account.")}
                      </p>
                    )}
                  </>
                ) : (
                  /* Public GitHub Repositories Search */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={publicSearchQuery}
                          onChange={(e) => {
                            setPublicSearchQuery(e.target.value);
                            void handleSearchPublicRepos(e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleSearchPublicRepos(publicSearchQuery);
                            }
                          }}
                          placeholder={language === "pt" ? "Pesquisar qualquer repositório público (ex: torvalds/linux, tailwindcss)..." : "Search any public repo (e.g. torvalds/linux, tailwindcss)..."}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-250 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSearchPublicRepos(publicSearchQuery)}
                        disabled={searchingPublic || !publicSearchQuery.trim()}
                        className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer shrink-0"
                      >
                        {searchingPublic ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          language === "pt" ? "Buscar" : "Search"
                        )}
                      </button>
                    </div>

                    {searchingPublic ? (
                      <div className="py-6 flex flex-col items-center justify-center space-y-2 text-zinc-400 text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />
                        <span>{language === "pt" ? "Consultando repositórios no GitHub..." : "Querying repositories on GitHub..."}</span>
                      </div>
                    ) : publicSearchResults.length > 0 ? (
                      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                        {publicSearchResults.map((repo) => (
                          <button
                            key={repo.id}
                            type="button"
                            onClick={() => handleSelectRepo(repo)}
                            className={`w-full p-2.5 text-left rounded-lg text-xs border transition-all cursor-pointer ${
                              repoInput === repo.full_name
                                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent shadow-xs"
                                : "bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/60 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-200"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center space-x-2 truncate">
                                <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                <span className="font-mono font-semibold truncate">{repo.full_name}</span>
                              </div>
                              <div className="flex items-center space-x-2 shrink-0 text-[10px] opacity-80">
                                {repo.language && (
                                  <span className="px-1.5 py-0.5 rounded-sm bg-zinc-100 dark:bg-zinc-700 font-medium">
                                    {repo.language}
                                  </span>
                                )}
                                {repo.stargazers_count > 0 && (
                                  <span className="flex items-center space-x-0.5 text-amber-500 font-medium">
                                    <Star className="w-2.5 h-2.5 fill-current" />
                                    <span>{repo.stargazers_count >= 1000 ? `${(repo.stargazers_count / 1000).toFixed(1)}k` : repo.stargazers_count}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            {repo.description && (
                              <p className="text-[11px] opacity-75 line-clamp-1 font-normal">
                                {repo.description}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : publicSearchQuery.trim().length >= 2 ? (
                      <div className="py-4 text-center text-xs text-zinc-400">
                        {language === "pt"
                          ? `Nenhum repositório público encontrado para "${publicSearchQuery}".`
                          : `No public repositories found for "${publicSearchQuery}".`}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-[11px] text-zinc-400">
                        {language === "pt"
                          ? "Digite palavras-chave (ex: 'react router', 'tensorflow', 'express') para pesquisar e conectar repositórios públicos."
                          : "Type keywords (e.g. 'react router', 'tensorflow', 'express') to search and connect public repositories."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {language === "pt" ? "Identificador do Repositório ou URL" : "Repository Identifier or URL"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                {isValid && repoValidation?.formatted && (
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {repoValidation.formatted}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={repoInput}
                  onChange={(e) => {
                    setRepoInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. facebook/react or https://github.com/vercel/next.js"
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 font-mono transition-colors ${
                    isInvalid
                      ? "border-amber-400 dark:border-amber-500/60 focus:ring-amber-500/30"
                      : isValid
                      ? "border-emerald-500 dark:border-emerald-500/70 focus:ring-emerald-500/30"
                      : "border-zinc-200 dark:border-zinc-750 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  }`}
                />
                {isValid && (
                  <div className="absolute right-3 top-2.5 text-emerald-500 pointer-events-none">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>

              {isInvalid && (
                <div className="flex items-center space-x-1.5 text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{repoValidation?.error}</span>
                </div>
              )}

              {isValid && (
                <div className="flex items-center space-x-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {language === "pt" ? "Repositório válido: " : "Valid repository: "}
                    <strong className="font-mono font-medium">{repoValidation?.formatted}</strong>
                  </span>
                </div>
              )}

              {!isInvalid && !isValid && (
                <p className="text-[11px] text-zinc-400 mt-1">
                  {language === "pt"
                    ? "Aceita 'proprietário/repositório' ou URL do GitHub (ex: facebook/react)."
                    : "Accepts 'owner/repo' or full GitHub URL (e.g. facebook/react)."}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Branch <span className="text-zinc-400 font-normal">(optional, default: repo default)</span>
              </label>
              <input
                type="text"
                value={repoBranch}
                onChange={(e) => setRepoBranch(e.target.value)}
                placeholder="e.g. main or master"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
              />
            </div>


            {loading && loadingStep && (
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 flex items-center space-x-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                <span>{loadingStep}</span>
              </div>
            )}

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">


              <div className="flex items-center space-x-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  {language === "pt" ? "Fechar / Cancelar" : "Close / Cancel"}
                </button>
                <button
                  id="modal-connect-repo-submit-btn"
                  type="submit"
                  disabled={loading || !trimmedRepoInput || isInvalid}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>
                    {loading
                      ? (language === "pt" ? "Analisando..." : "Analyzing...")
                      : (language === "pt" ? "Conectar Repositório" : "Connect Repository")}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Manual / Empty Project */}
        {activeTab === "manual" && (
          <form onSubmit={handleCreateManual} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {language === "pt" ? "Nome do Projeto" : "Project Name"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g. Payments Gateway"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {language === "pt" ? "Descrição" : "Description"}
              </label>
              <textarea
                rows={2}
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                placeholder={language === "pt" ? "Breve descrição do objetivo do serviço..." : "Brief description of the service purpose..."}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Framework
                </label>
                <input
                  type="text"
                  value={manualFramework}
                  onChange={(e) => setManualFramework(e.target.value)}
                  placeholder="e.g. Next.js"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {language === "pt" ? "Linguagem" : "Language"}
                </label>
                <input
                  type="text"
                  value={manualLanguage}
                  onChange={(e) => setManualLanguage(e.target.value)}
                  placeholder="e.g. TypeScript"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            </div>

            <p className="text-[11px] text-zinc-400">
              {language === "pt"
                ? "Inicia como um ledger limpo com 0 eventos, 0 nós e 0 suposições."
                : "Starts as an empty ledger with 0 events, 0 nodes, and 0 assumptions."}
            </p>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                {language === "pt" ? "Fechar / Cancelar" : "Close / Cancel"}
              </button>
              <button
                type="submit"
                disabled={loading || !manualName.trim()}
                className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading
                  ? (language === "pt" ? "Criando..." : "Creating...")
                  : (language === "pt" ? "Criar Projeto Limpo" : "Create Clean Project")}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  </div>
);
}
