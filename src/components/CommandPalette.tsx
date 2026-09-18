import React, { useEffect, useMemo, useState } from "react";
import {
  Search, FolderPlus, Sparkles, Settings as SettingsIcon, Sun, Moon, Laptop,
  FolderGit2, FileCode2, X, Code2, GitCommit, GitPullRequest, CircleDot, Brain,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useTheme } from "../context/ThemeContext";
import { authenticatedHeaders } from "../lib/api";

interface CommandPaletteProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onNavigate: (view: string) => void;
  openCreateProject: () => void;
}

type SearchResult = {
  kind: string;
  projectId?: string;
  projectName?: string;
  title: string;
  subtitle?: string;
  url?: string | null;
};

export function CommandPalette({
  isOpen,
  onOpen,
  onClose,
  onNavigate,
  openCreateProject,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [globalResults, setGlobalResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const { projects, setCurrentProject, setIsAskAfterOpen } = useProject();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        isOpen ? onClose() : onOpen();
      }
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const query = search.trim();
    if (query.length < 2) {
      setGlobalResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/repository/global-search?q=${encodeURIComponent(query)}`, {
          headers: await authenticatedHeaders({}, true),
        });
        const data = await response.json().catch(() => ({}));
        if (!cancelled) setGlobalResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        if (!cancelled) setGlobalResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, isOpen]);

  const actions = useMemo(() => [
    { id: "ask_after", title: "Ask AFTER Intelligence", category: "AI", icon: Sparkles, run: () => { onClose(); setIsAskAfterOpen(true); } },
    { id: "create_project", title: "Create New Project", category: "Projects", icon: FolderPlus, run: () => { onClose(); openCreateProject(); } },
    { id: "nav_repository", title: "Open Repository", category: "Navigation", icon: Code2, run: () => { onClose(); onNavigate("repository"); } },
    { id: "nav_graph", title: "Open Product Graph", category: "Navigation", icon: Brain, run: () => { onClose(); onNavigate("graph"); } },
    { id: "nav_insights", title: "Go to Insights", category: "Navigation", icon: Sparkles, run: () => { onClose(); onNavigate("insights"); } },
    { id: "nav_timeline", title: "View Recent Changes", category: "Navigation", icon: GitCommit, run: () => { onClose(); onNavigate("timeline"); } },
    { id: "nav_settings", title: "Open Settings", category: "Navigation", icon: SettingsIcon, run: () => { onClose(); onNavigate("settings"); } },
    { id: "theme_light", title: "Switch to Light Theme", category: "Appearance", icon: Sun, run: () => { setTheme("light"); onClose(); } },
    { id: "theme_dark", title: "Switch to Dark Theme", category: "Appearance", icon: Moon, run: () => { setTheme("dark"); onClose(); } },
    { id: "theme_system", title: "Follow System Theme", category: "Appearance", icon: Laptop, run: () => { setTheme("system"); onClose(); } },
  ], [onClose, onNavigate, openCreateProject, setIsAskAfterOpen, setTheme]);

  const filteredProjects = useMemo(
    () => projects.filter((p) => `${p.name} ${p.repository}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8),
    [projects, search]
  );
  const filteredActions = useMemo(
    () => actions.filter((a) => `${a.title} ${a.category}`.toLowerCase().includes(search.toLowerCase())),
    [actions, search]
  );

  const keyboardItems = useMemo<Array<{
    type: "search" | "project" | "action";
    run: () => void;
  }>>(
    () => [
      ...(search.trim().length >= 2
        ? globalResults.map((result) => ({
            type: "search" as const,
            run: () => { if (result.url) window.open(result.url, "_blank", "noopener,noreferrer"); },
          }))
        : []),
      ...filteredProjects.map((project) => ({
        type: "project" as const,
        run: () => { setCurrentProject(project); onClose(); },
      })),
      ...filteredActions.map((action) => ({
        type: "action" as const,
        run: action.run,
      })),
    ],
    [filteredActions, filteredProjects, globalResults, onClose, search, setCurrentProject]
  );

  useEffect(() => {
    setFocusedIndex(0);
  }, [search, globalResults.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleNavigation = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
      if (!keyboardItems.length) return;
      e.preventDefault();
      if (e.key === "ArrowDown") setFocusedIndex((current) => (current + 1) % keyboardItems.length);
      if (e.key === "ArrowUp") setFocusedIndex((current) => (current - 1 + keyboardItems.length) % keyboardItems.length);
      if (e.key === "Enter") keyboardItems[focusedIndex]?.run();
    };
    window.addEventListener("keydown", handleNavigation);
    return () => window.removeEventListener("keydown", handleNavigation);
  }, [focusedIndex, isOpen, keyboardItems]);

  if (!isOpen) return null;

  let renderIndex = -1;
  const nextIndex = () => { renderIndex += 1; return renderIndex; };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[72vh]">
        <div className="px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            id="command-palette-input"
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories, code, commits, issues, PRs, users…"
            className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
          />
          <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {search.trim().length >= 2 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Global search {searchLoading ? "· searching…" : ""}</div>
              <div className="space-y-0.5 mt-1">
                {globalResults.map((result) => {
                  const index = nextIndex();
                  const active = focusedIndex === index;
                  return (
                    <button key={`${result.kind}:${result.url || result.title}:${result.projectId || ""}`} type="button" aria-selected={active}
                      onClick={() => { if (result.url) window.open(result.url, "_blank", "noopener,noreferrer"); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs transition-colors ${active ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"}`}>
                      <FileCode2 className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div className="min-w-0 flex-1"><div className="font-medium truncate">{result.title}</div><div className="text-[10px] text-zinc-400 truncate">{result.kind}{result.projectName ? ` · ${result.projectName}` : ""}{result.subtitle ? ` · ${result.subtitle}` : ""}</div></div>
                    </button>
                  );
                })}
                {!searchLoading && globalResults.length === 0 && <div className="px-3 py-5 text-center text-xs text-zinc-400">No real repository result matched.</div>}
              </div>
            </div>
          )}

          {filteredProjects.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Projects</div>
              <div className="space-y-0.5 mt-1">
                {filteredProjects.map((project) => {
                  const index = nextIndex();
                  const active = focusedIndex === index;
                  return (
                    <button key={project.id} type="button" aria-selected={active} onClick={() => { setCurrentProject(project); onClose(); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors ${active ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                      <div className="flex items-center gap-2.5 truncate"><FolderGit2 className="w-4 h-4 text-zinc-400 shrink-0" /><span className="font-medium truncate">{project.name}</span><span className="text-zinc-400 font-mono text-[10px] truncate">{project.repository}</span></div>
                      <span className="text-[10px] text-zinc-400 shrink-0">Open</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Actions</div>
            <div className="space-y-0.5 mt-1">
              {filteredActions.map((action) => {
                const Icon = action.icon;
                const index = nextIndex();
                const active = focusedIndex === index;
                return (
                  <button key={action.id} type="button" aria-selected={active} onClick={action.run}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors ${active ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                    <div className="flex items-center gap-2.5"><Icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" /><span className="font-medium">{action.title}</span></div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 uppercase font-mono">{action.category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
          <span>↑ ↓ navigate · Enter open · ⌘K / Ctrl+K toggle</span><span>ESC</span>
        </div>
      </div>
    </div>
  );
}