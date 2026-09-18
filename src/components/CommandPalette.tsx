import React, { useEffect, useState } from "react";
import {
  Search,
  FolderPlus,
  Sparkles,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Laptop,
  FolderGit2,
  FileCode2,
  X,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useTheme } from "../context/ThemeContext";

interface CommandPaletteProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onNavigate: (view: string) => void;
  openCreateProject: () => void;
}

export function CommandPalette({
  isOpen,
  onOpen,
  onClose,
  onNavigate,
  openCreateProject,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const { projects, setCurrentProject, setIsAskAfterOpen } = useProject();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onOpen();
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: "ask_after",
      title: "Ask AFTER Intelligence",
      category: "AI",
      icon: Sparkles,
      run: () => {
        onClose();
        setIsAskAfterOpen(true);
      },
    },
    {
      id: "create_project",
      title: "Create New Project",
      category: "Projects",
      icon: FolderPlus,
      run: () => {
        onClose();
        openCreateProject();
      },
    },
    {
      id: "nav_overview",
      title: "Go to Overview",
      category: "Navigation",
      icon: FileCode2,
      run: () => {
        onClose();
        onNavigate("overview");
      },
    },
    {
      id: "nav_graph",
      title: "Go to Product Graph",
      category: "Navigation",
      icon: FolderGit2,
      run: () => {
        onClose();
        onNavigate("graph");
      },
    },
    {
      id: "nav_insights",
      title: "Go to Insights",
      category: "Navigation",
      icon: Sparkles,
      run: () => {
        onClose();
        onNavigate("insights");
      },
    },
    {
      id: "nav_experiments",
      title: "Go to Experiments",
      category: "Navigation",
      icon: FileCode2,
      run: () => {
        onClose();
        onNavigate("experiments");
      },
    },
    {
      id: "nav_timeline",
      title: "Go to Timeline",
      category: "Navigation",
      icon: FileCode2,
      run: () => {
        onClose();
        onNavigate("timeline");
      },
    },
    {
      id: "nav_settings",
      title: "Open Settings",
      category: "Navigation",
      icon: SettingsIcon,
      run: () => {
        onClose();
        onNavigate("settings");
      },
    },
    {
      id: "theme_light",
      title: "Switch to Light Theme",
      category: "Appearance",
      icon: Sun,
      run: () => {
        setTheme("light");
        onClose();
      },
    },
    {
      id: "theme_dark",
      title: "Switch to Dark Theme",
      category: "Appearance",
      icon: Moon,
      run: () => {
        setTheme("dark");
        onClose();
      },
    },
    {
      id: "theme_system",
      title: "Follow System Theme",
      category: "Appearance",
      icon: Laptop,
      run: () => {
        setTheme("system");
        onClose();
      },
    },
  ];

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredActions = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div
        className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search header */}
        <div className="px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center space-x-3">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            id="command-palette-input"
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search project..."
            className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* Projects results */}
          {filteredProjects.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Projects
              </div>
              <div className="space-y-0.5 mt-1">
                {filteredProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setCurrentProject(p);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <FolderGit2 className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span className="font-medium truncate">{p.name}</span>
                      <span className="text-zinc-400 font-mono text-[10px]">
                        {p.repository}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400">Switch</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action results */}
          <div>
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Actions
            </div>
            <div className="space-y-0.5 mt-1">
              {filteredActions.map((act) => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={act.run}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                      <span className="font-medium">{act.title}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 uppercase font-mono">
                      {act.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
          <span>Navigate with ⌘K / Ctrl+K</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
