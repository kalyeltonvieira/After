import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Github,
  Search,
  Lock,
  GitBranch,
  Star,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  FolderGit2,
  RefreshCw,
  LogOut,
  ExternalLink,
  X,
} from "lucide-react";
import { PixelCanvas } from "../components/PixelCanvas";
import { OnboardingOverlay } from "../components/OnboardingOverlay";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { listUserRepositoryPage, getConnectedGitHubUser, type GitHubRepositoryItem } from "../services/githubService";
import { LanguageColorDot, getLanguageColorByExtension } from "../utils/languageColors";

interface GitHubAuthPageProps {
  onBackToLanding?: () => void;
  onComplete?: () => void;
}

export function GitHubAuthPage({ onBackToLanding, onComplete }: GitHubAuthPageProps) {
  const { user, loginWithGitHub, signOut } = useAuth();
  const { connectRepository, isAnalyzing, scanStage } = useProject();
  const { language } = useLanguage();
  const isPt = language === "pt";

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Onboarding repository state
  const [repos, setRepos] = useState<GitHubRepositoryItem[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "public" | "private" | "ts">("all");
  const [connectingRepo, setConnectingRepo] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Determine active step: "login" if not authenticated, "onboarding" if authenticated
  const step = user ? "onboarding" : "login";

  // Load repositories as soon as user is authenticated
  useEffect(() => {
    if (!user) {
      setRepos([]);
      return;
    }

    let active = true;
    async function loadRepos() {
      setLoadingRepos(true);
      setConnectError(null);
      try {
        const page = await listUserRepositoryPage(1, 50);
        if (active) {
          setRepos(page.repos || []);
        }
      } catch (err: any) {
        if (active) {
          setConnectError(err?.message || (isPt ? "Não foi possível listar seus repositórios do GitHub." : "Could not list your GitHub repositories."));
        }
      } finally {
        if (active) setLoadingRepos(false);
      }
    }

    void loadRepos();
    return () => {
      active = false;
    };
  }, [user, isPt]);

  const handleGitHubLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await loginWithGitHub();
    } catch (err: any) {
      setLoginError(err?.message || (isPt ? "Falha ao conectar com o GitHub." : "Failed to connect with GitHub."));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSelectRepository = async (repo: GitHubRepositoryItem) => {
    setConnectingRepo(repo.full_name);
    setConnectError(null);
    try {
      await connectRepository({
        repository: repo.full_name,
        branch: repo.default_branch || "main",
      });
      // Show onboarding before completing
      setShowOnboarding(true);
    } catch (err: any) {
      setConnectError(err?.message || (isPt ? "Erro ao importar este repositório." : "Failed to import this repository."));
    } finally {
      setConnectingRepo(null);
    }
  };

  const filteredRepos = useMemo(() => {
    return repos.filter((repo) => {
      const matchesSearch =
        repo.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
        (repo.description || "").toLowerCase().includes(repoSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedFilter === "public") return !repo.private;
      if (selectedFilter === "private") return repo.private;
      if (selectedFilter === "ts") {
        const lang = (repo.language || "").toLowerCase();
        return lang.includes("typescript") || lang.includes("javascript");
      }
      return true;
    });
  }, [repos, repoSearch, selectedFilter]);

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-x-hidden select-none">
      {/* Monochromatic glowing moving pixel canvas in background */}
      <PixelCanvas className="opacity-90" />

      {/* Top minimal bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-16 flex items-center justify-between border-b border-zinc-800/40">
        <div className="flex items-center space-x-2.5">
          <div className="w-5 h-5 bg-white text-zinc-950 flex items-center justify-center font-mono font-black text-xs rounded-sm">
            A
          </div>
          <span className="font-mono font-bold tracking-tight text-sm text-white">AFTER</span>
          <span className="text-zinc-600 font-mono text-xs">/</span>
          <span className="text-zinc-400 font-mono text-xs">
            {step === "login" ? (isPt ? "Autenticação" : "Authentication") : (isPt ? "Onboarding" : "Onboarding")}
          </span>
        </div>

        {onBackToLanding && (
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-850"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isPt ? "Voltar ao início" : "Back to home"}</span>
          </button>
        )}
      </header>

      {/* Main Centered Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-8">
        <AnimatePresence mode="wait">
          {step === "login" ? (
            /* STEP 1: Centralized GitHub Login Card */
            <motion.div
              key="login-step"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md"
            >
              <div className="relative rounded-3xl p-8 sm:p-10 bg-zinc-950/85 border border-zinc-800/90 shadow-2xl backdrop-blur-2xl text-center overflow-hidden">
                {/* Glowing top hairline border */}
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                {/* Subdued pill tag */}
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/90 text-[11px] font-mono text-zinc-400 mb-6 shadow-xs">
                  <span className="w-1.5 h-1.5 bg-white rounded-xs animate-pulse" />
                  <span>AFTER · INTELLIGENCE</span>
                </div>

                {/* Main Titles */}
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-3">
                  {isPt ? "Entrar com GitHub" : "Sign in with GitHub"}
                </h1>
                <p className="text-sm text-zinc-400 leading-relaxed mb-8 max-w-sm mx-auto">
                  {isPt
                    ? "Conecte sua conta para acessar seus repositórios, mapear grafos de arquitetura e preservar o racional do seu software."
                    : "Connect your account to access your repositories, generate living architecture graphs, and preserve software rationale."}
                </p>

                {/* Central High-Contrast Button */}
                <button
                  type="button"
                  onClick={handleGitHubLogin}
                  disabled={isLoggingIn}
                  className="w-full group relative inline-flex items-center justify-center space-x-3 px-6 py-4 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-100 active:scale-[0.98] transition-all font-semibold text-sm shadow-xl shadow-white/5 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{isPt ? "Autorizando com GitHub..." : "Authorizing with GitHub..."}</span>
                    </>
                  ) : (
                    <>
                      <Github className="w-5 h-5 transition-transform group-hover:scale-105" />
                      <span>{isPt ? "Continuar com GitHub" : "Continue with GitHub"}</span>
                      <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>

                {loginError && (
                  <div className="mt-4 p-3 rounded-xl bg-red-950/50 border border-red-900/50 text-red-300 text-xs text-left">
                    {loginError}
                  </div>
                )}

                {/* Trust guarantee */}
                <div className="mt-7 pt-6 border-t border-zinc-850/80 flex items-center justify-center space-x-2 text-xs text-zinc-500 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  <span>{isPt ? "OAuth direto e seguro · Sem senhas" : "Direct & secure OAuth · No passwords"}</span>
                </div>
              </div>
            </motion.div>
          ) : (
            /* STEP 2: Onboarding - Escolha o Repositório do seu Perfil */
            <motion.div
              key="onboarding-step"
              initial={{ opacity: 0, scale: 0.98, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -16 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-4xl"
            >
              <div className="relative rounded-3xl p-6 sm:p-8 bg-zinc-950/90 border border-zinc-800/90 shadow-2xl backdrop-blur-2xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />

                {/* Top Profile Lockup */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-850 gap-4">
                  <div className="flex items-center space-x-3.5">
                    <img
                      src={user?.avatar_url || user?.photoURL}
                      alt={user?.login}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full border border-white/20 object-cover shadow-sm"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white text-base">{user?.name || user?.login}</span>
                        <span className="text-xs font-mono text-zinc-400">@{user?.login}</span>
                      </div>
                      <div className="text-xs text-emerald-400 font-mono flex items-center space-x-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{isPt ? "GitHub Conectado" : "GitHub Connected"}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-400">{repos.length} {isPt ? "repositórios" : "repositories"}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="inline-flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg border border-zinc-850 hover:bg-zinc-900 cursor-pointer self-start sm:self-auto"
                    title={isPt ? "Trocar de conta" : "Switch account"}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{isPt ? "Trocar conta" : "Switch account"}</span>
                  </button>
                </div>

                {/* Step Headline */}
                <div className="mt-6 mb-6">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                    {isPt ? "Escolha o repositório do seu perfil" : "Choose a repository from your profile"}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    {isPt
                      ? "Puxamos seus repositórios diretamente do GitHub. Clique para iniciar a análise arquitetural completa:"
                      : "We retrieved your repositories directly from GitHub. Click to start full architectural analysis:"}
                  </p>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      placeholder={isPt ? "Buscar repositório pelo nome..." : "Search repository by name..."}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-white/50 transition-colors"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setSelectedFilter("all")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                        selectedFilter === "all" ? "bg-white text-zinc-950 font-semibold" : "text-zinc-400 hover:text-white bg-zinc-900/60"
                      }`}
                    >
                      {isPt ? "Todos" : "All"} ({repos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFilter("public")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                        selectedFilter === "public" ? "bg-white text-zinc-950 font-semibold" : "text-zinc-400 hover:text-white bg-zinc-900/60"
                      }`}
                    >
                      {isPt ? "Públicos" : "Public"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFilter("private")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                        selectedFilter === "private" ? "bg-white text-zinc-950 font-semibold" : "text-zinc-400 hover:text-white bg-zinc-900/60"
                      }`}
                    >
                      {isPt ? "Privados" : "Private"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFilter("ts")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                        selectedFilter === "ts" ? "bg-white text-zinc-950 font-semibold" : "text-zinc-400 hover:text-white bg-zinc-900/60"
                      }`}
                    >
                      TS/JS
                    </button>
                  </div>
                </div>

                {connectError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-900 text-red-200 text-xs flex items-center justify-between">
                    <span>{connectError}</span>
                    <button type="button" onClick={() => setConnectError(null)} className="text-red-400 hover:text-white ml-2">
                      ✕
                    </button>
                  </div>
                )}

                {/* Repository List / Grid */}
                <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1.5 custom-scrollbar">
                  {loadingRepos ? (
                    <div className="py-16 text-center text-zinc-500 font-mono text-xs flex flex-col items-center space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                      <span>{isPt ? "Carregando repositórios do seu perfil..." : "Loading repositories from your profile..."}</span>
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-xs">
                      {isPt ? "Nenhum repositório encontrado com esse filtro." : "No repository matched your filter."}
                    </div>
                  ) : (
                    filteredRepos.map((repo) => {
                      const isSelected = connectingRepo === repo.full_name;
                      return (
                        <div
                          key={repo.id}
                          onClick={() => !isSelected && handleSelectRepository(repo)}
                          className={`group relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-zinc-900 border-white/60 shadow-lg"
                              : "bg-zinc-900/50 border-zinc-850 hover:bg-zinc-900/90 hover:border-zinc-700"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <FolderGit2 className="w-4 h-4 text-zinc-400 shrink-0" />
                              <span className="font-semibold text-sm text-white group-hover:text-white transition-colors truncate">
                                {repo.name}
                              </span>
                              {repo.private ? (
                                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-sm bg-zinc-800 text-[10px] font-mono text-zinc-400">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>{isPt ? "privado" : "private"}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-zinc-500">
                                  {isPt ? "público" : "public"}
                                </span>
                              )}
                            </div>

                            {repo.description && (
                              <p className="text-xs text-zinc-400 mt-1 line-clamp-1">
                                {repo.description}
                              </p>
                            )}

                            <div className="flex items-center space-x-3 text-[11px] font-mono text-zinc-500 mt-2">
                              {repo.language && (
                                <div className="flex items-center space-x-1.5">
                                  <LanguageColorDot language={repo.language} />
                                  <span>{repo.language}</span>
                                </div>
                              )}
                              <div className="flex items-center space-x-1">
                                <GitBranch className="w-3 h-3 text-zinc-500" />
                                <span>{repo.default_branch || "main"}</span>
                              </div>
                              {repo.stargazers_count > 0 && (
                                <div className="flex items-center space-x-1">
                                  <Star className="w-3 h-3 text-amber-400" />
                                  <span>{repo.stargazers_count}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center space-x-2">
                            {isSelected ? (
                              <div className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white text-zinc-950 font-medium text-xs">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>{isPt ? "Inicializando..." : "Initializing..."}</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-white hover:text-zinc-950 text-white font-medium text-xs transition-colors cursor-pointer group-hover:bg-white group-hover:text-zinc-950"
                              >
                                <span>{isPt ? "Analisar" : "Analyze"}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Analysis Stage Overlay */}
                {isAnalyzing && (
                  <div className="mt-5 p-4 rounded-2xl bg-zinc-900 border border-white/20 text-center animate-pulse">
                    <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-1">
                      {isPt ? "Análise de Arquitetura em Andamento" : "Architecture Analysis in Progress"}
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {scanStage === "architecture"
                        ? (isPt ? "Mapeando módulos e conexões..." : "Mapping modules and connections...")
                        : scanStage === "dependencies"
                        ? (isPt ? "Resolvendo dependências e imports..." : "Resolving dependencies and imports...")
                        : scanStage === "history"
                        ? (isPt ? "Extraindo memória e histórico do Git..." : "Extracting memory and Git history...")
                        : (isPt ? "Sincronizando repositório..." : "Synchronizing repository...")}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Minimal */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 h-12 flex items-center justify-between text-[11px] font-mono text-zinc-500 border-t border-zinc-850/40">
        <div>AFTER · Software Evolution Platform</div>
        <div>{isPt ? "Software que não envelhece sozinho." : "Software that doesn't age alone."}</div>
      </footer>

      <AnimatePresence>
        {showOnboarding && (
          <OnboardingOverlay 
            language={language}
            onComplete={() => onComplete?.()}
            onSkip={() => onComplete?.()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
