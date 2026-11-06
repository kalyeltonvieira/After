import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FolderGit2,
  FolderPlus,
  Globe,
  Github,
  Lock,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  getConnectedGitHubUser,
  listUserRepositoryPage,
  searchPublicRepositories,
  type GitHubRepositoryItem,
  type GitHubUser,
} from "../services/githubService";

interface ConnectProjectPageProps {
  onBack: () => void;
}

type Source = "profile" | "search";

export function ConnectProjectPage({ onBack }: ConnectProjectPageProps) {
  const { connectRepository } = useProject();
  const { connectGitHub, isGitHubConnected, refreshGitHubSession } = useAuth();
  const { language } = useLanguage();
  const isPt = language === "pt";

  const [source, setSource] = useState<Source>("search");
  const [profile, setProfile] = useState<GitHubUser | null>(null);
  const [profileRepos, setProfileRepos] = useState<GitHubRepositoryItem[]>([]);
  const [profileFilter, setProfileFilter] = useState("");
  const [profilePage, setProfilePage] = useState(0);
  const [profileHasNext, setProfileHasNext] = useState(false);
  const [loadingMoreProfile, setLoadingMoreProfile] = useState(false);
  const profileScrollRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GitHubRepositoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProfileRepos = useMemo(() => {
    const normalized = profileFilter.trim().toLowerCase();
    if (!normalized) return profileRepos;
    return profileRepos.filter((repo) =>
      `${repo.full_name} ${repo.description || ""} ${repo.language || ""}`.toLowerCase().includes(normalized)
    );
  }, [profileFilter, profileRepos]);

  const loadProfileRepos = async (forceFresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const [user, firstPage] = await Promise.all([
        getConnectedGitHubUser(forceFresh),
        listUserRepositoryPage(1, 24),
      ]);
      setProfile(user);
      setProfileRepos(firstPage.repos);
      setProfilePage(1);
      setProfileHasNext(firstPage.hasNext);
    } catch (err: any) {
      setError(err?.message || (isPt ? "Não foi possível carregar seu perfil do GitHub." : "Could not load your GitHub profile."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (source !== "profile") return;
    if (!isGitHubConnected) {
      setLoading(false);
      setProfile(null);
      setProfileRepos([]);
      return;
    }
    void loadProfileRepos();
  }, [source, isGitHubConnected]);

  const handleConnectGitHub = async () => {
    setConnectingGitHub(true);
    setError(null);
    try {
      await connectGitHub();
      await loadProfileRepos(true);
    } catch (err: any) {
      setError(err?.message || (isPt ? "Não foi possível conectar sua conta GitHub." : "Could not connect your GitHub account."));
    } finally {
      setConnectingGitHub(false);
    }
  };

  const loadMoreProfileRepos = async () => {
    if (source !== "profile" || loading || loadingMoreProfile || !profileHasNext) return;
    setLoadingMoreProfile(true);
    try {
      const nextPage = await listUserRepositoryPage(profilePage + 1, 24);
      setProfileRepos((current) => {
        const existing = new Set(current.map((repo) => repo.full_name));
        return [...current, ...nextPage.repos.filter((repo) => !existing.has(repo.full_name))];
      });
      setProfilePage(nextPage.page);
      setProfileHasNext(nextPage.hasNext);
    } catch (err: any) {
      setError(err?.message || (isPt ? "Não foi possível carregar mais repositórios." : "Could not load more repositories."));
    } finally {
      setLoadingMoreProfile(false);
    }
  };

  useEffect(() => {
    const element = profileScrollRef.current;
    if (!element || source !== "profile") return;
    const onScroll = () => {
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 360) {
        void loadMoreProfileRepos();
      }
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [source, profilePage, profileHasNext, loading, loadingMoreProfile]);

  const runSearch = async () => {
    const value = query.trim();
    if (value.length < 2) {
      setResults([]);
      setError(isPt ? "Digite pelo menos 2 caracteres para pesquisar." : "Enter at least 2 characters to search.");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const response = await searchPublicRepositories(value, { per_page: 30, sort: "updated" });
      setResults(response.items || []);
    } catch (err: any) {
      setError(err?.message || (isPt ? "Falha ao pesquisar no GitHub." : "GitHub search failed."));
    } finally {
      setSearching(false);
    }
  };

  const connect = async (repo: GitHubRepositoryItem) => {
    setConnecting(repo.full_name);
    setError(null);
    try {
      await connectRepository({ repository: repo.full_name, branch: repo.default_branch || "main" });
      onBack();
    } catch (err: any) {
      setError(err?.message || (isPt ? "Não foi possível conectar este repositório." : "Could not connect this repository."));
    } finally {
      setConnecting(null);
    }
  };

  const repos = source === "profile" ? filteredProfileRepos : results;

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-7">
      <div className="flex items-start gap-4">
        <button type="button" onClick={onBack} className="mt-1 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors" aria-label={isPt ? "Voltar" : "Back"}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-400"><FolderPlus className="w-3.5 h-3.5" /> {isPt ? "Novo projeto" : "New project"}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{isPt ? "Conectar um repositório" : "Connect a repository"}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {isPt ? "Escolha um repositório do seu perfil ou pesquise qualquer usuário, organização ou projeto público no GitHub." : "Choose a repository from your profile or search any GitHub user, organization, or public project."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-5 items-start">
        <aside className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-2 space-y-1">
          <button type="button" onClick={() => setSource("profile")} className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${source === "profile" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
            <UserRound className="w-4 h-4" />
            <span><strong className="block text-xs">{isPt ? "Meu perfil" : "My profile"}</strong><small className="block mt-0.5 opacity-70">{isPt ? "Seus repositórios" : "Your repositories"}</small></span>
          </button>
          <button type="button" onClick={() => setSource("search")} className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${source === "search" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
            <Globe className="w-4 h-4" />
            <span><strong className="block text-xs">{isPt ? "Pesquisar GitHub" : "Search GitHub"}</strong><small className="block mt-0.5 opacity-70">{isPt ? "Usuário ou projeto" : "User or project"}</small></span>
          </button>
        </aside>

        <section className="min-w-0 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white/70 dark:bg-zinc-950/40">
          <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
            {source === "profile" ? (
              isGitHubConnected ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-700" /> : <Github className="w-5 h-5 text-zinc-400" />}
                    <div className="min-w-0"><div className="text-sm font-semibold truncate">{profile ? `@${profile.login}` : (isPt ? "Seu perfil GitHub" : "Your GitHub profile")}</div><div className="text-[11px] text-zinc-400">{profileRepos.length} {isPt ? "carregados" : "loaded"}{profileHasNext ? " · mais disponíveis" : ""}</div></div>
                  </div>
                  <div className="relative sm:w-64"><Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" /><input value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)} placeholder={isPt ? "Filtrar seus repositórios" : "Filter your repositories"} className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-9 pr-3 py-2 text-xs outline-none focus:border-sky-400" /></div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div><div className="text-sm font-semibold">{isPt ? "Conecte sua conta GitHub" : "Connect your GitHub account"}</div><p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{isPt ? "A conexão é opcional e serve apenas para listar seus repositórios e acessar projetos privados." : "This optional connection lets AFTER list your repositories and access private projects."}</p></div>
                  <button type="button" onClick={() => void handleConnectGitHub()} disabled={connectingGitHub} className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-3 py-2.5 text-xs font-medium text-white dark:text-zinc-900 disabled:opacity-50"><Github className="w-3.5 h-3.5"/>{connectingGitHub ? (isPt ? "Conectando..." : "Connecting...") : (isPt ? "Conectar GitHub" : "Connect GitHub")}</button>
                </div>
              )
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); void runSearch(); }} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1"><Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isPt ? "Pesquisar usuário ou repositório no GitHub…" : "Search a GitHub user or repository…"} className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-10 pr-3 py-2.5 text-sm outline-none focus:border-sky-400" /></div>
                <button type="submit" disabled={searching} className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-xs font-medium disabled:opacity-50">{searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}{isPt ? "Pesquisar" : "Search"}</button>
              </form>
            )}
          </div>

          {error && <div className="m-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-300">{error}</div>}
          {source === "profile" && !isGitHubConnected ? (
            <div className="p-12 text-center">
              <Github className="w-8 h-8 mx-auto mb-3 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{isPt ? "Seu GitHub ainda não está conectado" : "Your GitHub is not connected yet"}</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{isPt ? "Você pode pesquisar repositórios públicos sem conectar nada. Para listar os seus próprios projetos ou acessar repositórios privados, autorize o GitHub." : "You can search public repositories without connecting anything. To list your own projects or access private repositories, authorize GitHub."}</p>
              <button type="button" onClick={() => void handleConnectGitHub()} disabled={connectingGitHub} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-xs font-medium text-white dark:text-zinc-900 disabled:opacity-50"><Github className="w-3.5 h-3.5"/>{connectingGitHub ? (isPt ? "Aguardando autorização..." : "Waiting for authorization...") : (isPt ? "Conectar conta GitHub" : "Connect GitHub account")}<ArrowRight className="w-3.5 h-3.5"/></button>
            </div>
          ) : loading && source === "profile" ? <div className="p-12 text-center text-xs text-zinc-400"><RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />{isPt ? "Carregando seus repositórios…" : "Loading your repositories…"}</div> : (
            <div ref={profileScrollRef} className={`p-4 grid grid-cols-1 md:grid-cols-2 gap-3 ${source === "profile" ? "max-h-[68vh] overflow-y-auto overscroll-contain" : ""}`}>
              {repos.map((repo) => (
                <article key={repo.id || repo.full_name} className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-sky-400 dark:hover:border-sky-800 hover:shadow-lg hover:shadow-sky-950/5 transition-all">
                  <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2 min-w-0"><FolderGit2 className="w-4 h-4 shrink-0 text-sky-500" /><h2 className="text-sm font-semibold truncate">{repo.full_name}</h2></div>{repo.private ? <Lock className="w-3.5 h-3.5 shrink-0 text-amber-500" /> : <Globe className="w-3.5 h-3.5 shrink-0 text-emerald-500" />}</div>
                  <p className="mt-2 min-h-8 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{repo.description || (isPt ? "Sem descrição no GitHub." : "No GitHub description.")}</p>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-zinc-400"><span>{repo.language || "Code"} · ★ {repo.stargazers_count || 0}</span><a href={repo.html_url} target="_blank" rel="noreferrer" className="hover:text-zinc-900 dark:hover:text-white"><ExternalLink className="w-3.5 h-3.5" /></a></div>
                  <button type="button" onClick={() => void connect(repo)} disabled={Boolean(connecting)} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 text-xs font-medium disabled:opacity-50">{connecting === repo.full_name ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}{connecting === repo.full_name ? (isPt ? "Conectando…" : "Connecting…") : (isPt ? "Conectar projeto" : "Connect project")}<ArrowRight className="w-3.5 h-3.5" /></button>
                </article>
              ))}
              {source === "profile" && loadingMoreProfile && <div className="md:col-span-2 flex items-center justify-center gap-2 py-4 text-xs text-zinc-400"><RefreshCw className="w-3.5 h-3.5 animate-spin" />{isPt ? "Carregando mais repositórios…" : "Loading more repositories…"}</div>}
              {source === "profile" && !loadingMoreProfile && profileHasNext && <div className="md:col-span-2 text-center py-3 text-[10px] text-zinc-400">{isPt ? "Role para carregar mais automaticamente" : "Scroll to load more automatically"}</div>}
              {!repos.length && !error && <div className="md:col-span-2 p-12 text-center text-xs text-zinc-400"><Github className="w-7 h-7 mx-auto mb-3 opacity-40" />{source === "search" ? (isPt ? "Pesquise um usuário ou repositório para começar." : "Search for a user or repository to begin.") : (isPt ? "Nenhum repositório encontrado no seu perfil." : "No repositories found in your profile.")}</div>}
            </div>
          )}
        </section>
      </div>

      {source === "profile" && error && <button type="button" onClick={() => void refreshGitHubSession().then(() => loadProfileRepos(true)).catch((err) => setError(err?.message || String(err)))} className="inline-flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400 hover:underline"><RefreshCw className="w-3.5 h-3.5" />{isPt ? "Renovar conexão GitHub" : "Refresh GitHub connection"}</button>}
    </div>
  );
}
