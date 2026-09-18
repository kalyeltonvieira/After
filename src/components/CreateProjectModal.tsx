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
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  getConnectedGitHubUser,
  listUserRepositories,
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
  const { refreshGitHubSession } = useAuth();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<"github" | "manual">("github");

  // GitHub connection fields
  const [repoInput, setRepoInput] = useState("");
  const [repoBranch, setRepoBranch] = useState("");

  // GitHub User & Repositories state
  const [connectedUser, setConnectedUser] = useState<GitHubUser | null>(null);
  const [userRepos, setUserRepos] = useState<GitHubRepositoryItem[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
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
    void loadGitHubUserData();
  }, [isOpen]);

  const loadGitHubUserData = async () => {
    setLoadingRepos(true);
    setError(null);

    const load = async () => {
      const [user, repos] = await Promise.all([
        getConnectedGitHubUser(),
        listUserRepositories(),
      ]);
      setConnectedUser(user);
      setUserRepos(repos);
    };

    try {
      await load();
    } catch (firstError: any) {
      const message = String(firstError?.message || "");
      const shouldRefreshSession =
        /Connect GitHub first|Invalid or expired Firebase session|Firebase authentication is required|Invalid or expired GitHub access token|GitHub token is invalid or expired/i.test(message);

      if (shouldRefreshSession) {
        try {
          await refreshGitHubSession();
          await load();
        } catch (refreshError: any) {
          const refreshMessage = String(refreshError?.message || "");
          setConnectedUser(null);
          setUserRepos([]);
          setError(
            refreshMessage ||
              "A conexão com o GitHub expirou. Conecte o GitHub novamente para carregar seus repositórios."
          );
        }
      } else {
        setConnectedUser(null);
        setUserRepos([]);
        setError(message || "Não foi possível carregar seus repositórios do GitHub.");
      }
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleSelectRepo = (repo: GitHubRepositoryItem) => {
    setRepoInput(repo.full_name);
    setRepoBranch(repo.default_branch || "main");
    setError(null);
  };

  const handleConnectGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoInput.trim()) {
      setError("Please enter a repository (e.g. facebook/react or full GitHub URL)");
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingStep("Querying repository metadata and branches...");

    try {
      setLoadingStep("Parsing file tree, dependencies, and architecture nodes...");
      await connectRepository({
        repository: repoInput.trim(),
        branch: repoBranch.trim() || undefined,
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || "Failed to connect repository");
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
                    GitHub conectado
                  </span>
                </div>
                {connectedUser && (
                  <div className="flex items-center space-x-2">
                    <img
                      src={connectedUser.avatar_url}
                      alt={connectedUser.login}
                      className="w-5 h-5 rounded-full border border-zinc-200 dark:border-zinc-700"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      @{connectedUser.login}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                    Repositórios disponíveis ({userRepos.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => loadGitHubUserData()}
                    className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingRepos ? "animate-spin" : ""}`} />
                    <span>Atualizar</span>
                  </button>
                </div>

                {userRepos.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="w-3 h-3 text-zinc-400" />
                      <input
                        value={repoSearch}
                        onChange={(e) => setRepoSearch(e.target.value)}
                        placeholder="Buscar repositórios…"
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
                          className={`w-full p-2 text-left rounded-lg text-xs flex items-center justify-between border transition-all cursor-pointer ${repoInput === repo.full_name
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
                    {loadingRepos ? "Carregando seus repositórios..." : "Nenhum repositório disponível para esta conta do GitHub."}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Repository Identifier or URL <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="e.g. facebook/react or https://github.com/vercel/next.js"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Works directly with any public GitHub repository.
              </p>
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
                  disabled={loading || !repoInput.trim()}
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
