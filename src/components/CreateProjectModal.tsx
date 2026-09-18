import React, { useState, useEffect } from "react";
import {
  X,
  GitBranch,
  Github,
  Code2,
  Sparkles,
  FolderPlus,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  Lock,
  Globe,
  Star,
  CheckCircle2,
  RefreshCw,
  Search,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import {
  getGitHubAuthUrl,
  exchangeGitHubCode,
  openGitHubOAuthPopup,
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
  const { connectRepository, createProject, createDemoProject } = useProject();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<"github" | "manual" | "demo">("github");

  // GitHub connection fields
  const [repoInput, setRepoInput] = useState("");
  const [repoBranch, setRepoBranch] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);

  // GitHub User & Repositories state
  const [connectedUser, setConnectedUser] = useState<GitHubUser | null>(null);
  const [userRepos, setUserRepos] = useState<GitHubRepositoryItem[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Manual project fields
  const [manualName, setManualName] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualFramework, setManualFramework] = useState("React & TypeScript");
  const [manualLanguage, setManualLanguage] = useState("TypeScript");

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Check OAuth availability
  const [oauthAvailable, setOauthAvailable] = useState<boolean>(false);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);

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
    getGitHubAuthUrl()
      .then((data) => {
        if (data.configured && data.url) {
          setOauthAvailable(true);
          setOauthUrl(data.url);
        } else {
          setOauthAvailable(false);
        }
      })
      .catch(() => setOauthAvailable(false));
  }, [isOpen]);

  const loadGitHubUserData = async (token: string) => {
    setLoadingRepos(true);
    try {
      const [user, repos] = await Promise.all([
        getConnectedGitHubUser(token).catch(() => null),
        listUserRepositories(token).catch(() => []),
      ]);
      if (user) setConnectedUser(user);
      if (repos && repos.length > 0) setUserRepos(repos);
    } catch (err: any) {
      console.warn("Could not load user repos:", err);
    } finally {
      setLoadingRepos(false);
    }
  };

  // Launch OAuth Popup leveraging server/app.ts callback
  const handleLaunchOAuth = async () => {
    if (!oauthUrl) return;
    setError(null);
    setLoading(true);
    setLoadingStep("Opening GitHub OAuth window...");

    try {
      const result = await openGitHubOAuthPopup(oauthUrl);
      if (result.error && result.error !== "Popup was closed by user") {
        setError(`GitHub authorization error: ${result.error}`);
        return;
      }
      if (result.code) {
        setLoadingStep("Exchanging authorization token...");
        const { token } = await exchangeGitHubCode(result.code);
        setGithubToken(token);
        setShowTokenInput(true);
        setLoadingStep("Loading your repositories from GitHub...");
        await loadGitHubUserData(token);
      }
    } catch (err: any) {
      setError(err.message || "OAuth connection failed");
    } finally {
      setLoading(false);
      setLoadingStep("");
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
        githubToken: githubToken.trim() || undefined,
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

  const handleCreateDemo = async () => {
    setLoading(true);
    setLoadingStep(
      language === "pt"
        ? "Carregando projeto de demonstração com telemetria..."
        : "Loading demo project with telemetry..."
    );
    setError(null);
    try {
      await createDemoProject();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || "Failed to create demo project");
    } finally {
      setLoading(false);
      setLoadingStep("");
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
            <button
              type="button"
              onClick={() => {
                setActiveTab("demo");
                setError(null);
              }}
              className={`flex-1 py-2 font-medium rounded-lg transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === "demo"
                  ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === "pt" ? "Demo Exemplo" : "Demo Project"}</span>
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
            {oauthAvailable && (
              <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      GitHub OAuth Integration
                    </span>
                  </div>
                  {connectedUser ? (
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
                  ) : (
                    <button
                      type="button"
                      onClick={handleLaunchOAuth}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span>Authorize with GitHub</span>
                    </button>
                  )}
                </div>

                {connectedUser ? (
                  <div className="space-y-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Your Repositories ({userRepos.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => githubToken && loadGitHubUserData(githubToken)}
                        className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingRepos ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                      </button>
                    </div>

                    {userRepos.length > 0 ? (
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {userRepos.slice(0, 15).map((repo) => (
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
                              {repo.private ? (
                                <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                              ) : (
                                <Globe className="w-3 h-3 text-zinc-400 shrink-0" />
                              )}
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
                    ) : (
                      <p className="text-[11px] text-zinc-400">
                        {loadingRepos ? "Loading your repositories..." : "No repositories found for this account."}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Connect your GitHub account to observe both public and private repositories without rate limits.
                  </p>
                )}
              </div>
            )}

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

            {/* Optional Personal Access Token */}
            <div>
              <button
                type="button"
                onClick={() => setShowTokenInput(!showTokenInput)}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center space-x-1 cursor-pointer"
              >
                <KeyRound className="w-3 h-3" />
                <span>{showTokenInput ? "Hide Personal Access Token" : "Provide GitHub Personal Access Token (for private repos)"}</span>
              </button>

              {showTokenInput && (
                <div className="mt-2">
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Used strictly server-side during analysis and never exposed to the client.
                  </p>
                </div>
              )}
            </div>

            {loading && loadingStep && (
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 flex items-center space-x-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                <span>{loadingStep}</span>
              </div>
            )}

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("demo")}
                className="text-xs text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{language === "pt" ? "Ou testar com Projeto Demo" : "Or test with Demo Project"}</span>
              </button>

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

        {/* Tab 3: Instant Demo Project */}
        {activeTab === "demo" && (
          <div className="space-y-4 py-1">
            <div className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
              <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300">
                <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold">
                  {language === "pt" ? "Explorar com Projeto de Demonstração" : "Explore with Demo Project"}
                </span>
              </div>
              <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
                {language === "pt"
                  ? "Não tem um repositório para conectar agora? Inicialize instantaneamente um projeto completo de e-commerce distribuído com microserviços, telemetria OpenTelemetry, grafo de dependências e relatórios arquiteturais prontos."
                  : "Don't have a repository ready to connect? Instantly initialize a complete distributed e-commerce project with microservices, OpenTelemetry metrics, live dependency graph, and forensic reports."}
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>{language === "pt" ? "O que será carregado:" : "What will be loaded:"}</span>
              </div>
              <ul className="list-disc list-inside space-y-1.5 pl-1">
                <li>{language === "pt" ? "Grafo de 5 nós (API Gateway, Auth, Checkout, Kafka, Postgres)" : "5-node dependency graph (API Gateway, Auth, Checkout, Kafka, Postgres)"}</li>
                <li>{language === "pt" ? "Telemetria de saúde contínua e risco de concorrência detectado" : "Continuous evolutionary health telemetry and concurrency risks"}</li>
                <li>{language === "pt" ? "Rastreamento de hipóteses e experimento ativo de rollback" : "Hypothesis tracking and active rollback experiment"}</li>
                <li>{language === "pt" ? "Histórico de eventos de evolução de arquitetura" : "Architectural evolution events timeline"}</li>
              </ul>
            </div>

            {loading && loadingStep && (
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 flex items-center space-x-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{loadingStep}</span>
              </div>
            )}

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                {language === "pt" ? "Fechar / Cancelar" : "Close / Cancel"}
              </button>
              <button
                type="button"
                onClick={handleCreateDemo}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-xs font-medium transition-all flex items-center space-x-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {loading
                    ? (language === "pt" ? "Criando Demo..." : "Creating Demo...")
                    : (language === "pt" ? "Criar Projeto Demo Agora" : "Create Demo Project Now")}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
}
