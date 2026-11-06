import React from "react";
import {
  LayoutDashboard,
  FolderGit2,
  Network,
  Sparkles,
  FlaskConical,
  History,
  Settings,
  X,
  ExternalLink,
  Code2,
  Brain,
  Eye,
  GitCompareArrows,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  currentView,
  onNavigate,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { insights, experiments } = useProject();
  const { t, language } = useLanguage();
  const isCompact = isCollapsed && !isMobileOpen;

  const navigationItems = [
    { id: "overview", label: t("nav_overview"), icon: LayoutDashboard },
    { id: "projects", label: t("nav_projects"), icon: FolderGit2 },
    { id: "repository", label: language === "pt" ? "Repositório" : "Repository", icon: Code2 },
    { id: "graph", label: t("nav_graph"), icon: Network },
    { id: "memory", label: language === "pt" ? "Memória" : "Memory", icon: Brain },
    {
      id: "insights",
      label: t("nav_insights"),
      icon: Sparkles,
      badge: insights.length > 0 ? insights.length : undefined,
    },
    {
      id: "experiments",
      label: t("nav_experiments"),
      icon: FlaskConical,
      badge: experiments.filter((e) => e.status === "running").length || undefined,
    },
    { id: "timeline", label: t("nav_timeline"), icon: History },
    { id: "watch", label: language === "pt" ? "Observar" : "Watch", icon: Eye },
    { id: "compare", label: language === "pt" ? "Comparar arquitetura" : "Architecture compare", icon: GitCompareArrows },
    { id: "report", label: language === "pt" ? "Relatório executivo" : "Executive report", icon: FileText },
    { id: "settings", label: t("nav_settings"), icon: Settings },
  ];

  const content = (
    <motion.div layout className={`flex flex-col h-full justify-between py-4 ${isCompact ? "px-2" : "px-3"}`} transition={{ layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}>
      {/* Top Nav Items */}
      <div className="space-y-1">
        <div className="px-3 pb-3 mb-2 border-b border-zinc-100 dark:border-zinc-800/80 md:hidden flex items-center justify-between">
          <span className="font-mono font-bold tracking-tight text-sm text-zinc-900 dark:text-zinc-100">
            AFTER
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`hidden md:flex items-center mb-3 ${isCompact ? "justify-center" : "justify-between px-2"}`}>
          <AnimatePresence initial={false} mode="popLayout">
            {!isCompact && (
              <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }} className="font-mono text-[10px] font-semibold tracking-[0.18em] text-zinc-400 whitespace-nowrap">
                AFTER / NAV
              </motion.span>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer"
            aria-label={isCompact ? "Expand navigation" : "Collapse navigation"}
            title={`${isCompact ? "Expand" : "Collapse"} navigation (Ctrl+B / ⌘B)`}
          >
            {isCompact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <div className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 ${isCompact ? "text-center" : ""}`}>
          <AnimatePresence initial={false} mode="wait">
            {isCompact ? (
              <motion.span key="compact-nav" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>•••</motion.span>
            ) : (
              <motion.span key="expanded-nav" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.18 }}>{t("nav_navigation")}</motion.span>
            )}
          </AnimatePresence>
        </div>

        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <motion.button
              id={`nav-item-${item.id}`}
              key={item.id}
              type="button"
              whileTap={{ scale: 0.98 }}
              layout
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              className={`relative w-full flex items-center ${isCompact ? "justify-center px-2" : "justify-between px-3"} py-2 rounded-xl text-xs font-medium transition-colors duration-150 cursor-pointer ${
                isActive
                  ? "text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute inset-0 rounded-xl bg-zinc-900 dark:bg-zinc-100 shadow-xs"
                  transition={{
                    type: "spring",
                    stiffness: 450,
                    damping: 35,
                  }}
                />
              )}
              <div className="relative z-10 flex items-center space-x-2.5">
                <Icon className="w-4 h-4 shrink-0 stroke-[1.75]" />
                <AnimatePresence initial={false} mode="popLayout">
                  {!isCompact && <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.16 }} className="whitespace-nowrap">{item.label}</motion.span>}
                </AnimatePresence>
              </div>
              <AnimatePresence initial={false}>
              {item.badge !== undefined && !isCompact && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                    isActive
                      ? "bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-800"
                      : "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {item.badge}
                </motion.span>
              )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {/* Bottom Philosophy Card */}
      <AnimatePresence initial={false}>
      {!isCompact && <motion.div initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: 8, height: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/80 space-y-1.5 overflow-hidden">
        <div className="flex items-center space-x-1.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span>{language === "pt" ? "Observação Contínua" : "Continuous Observation"}</span>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans italic">
          "{language === "pt" ? "Software que não envelhece sozinho." : "Software that doesn't age alone."}"
        </p>
      </motion.div>}
      </AnimatePresence>
    </motion.div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <motion.aside animate={{ width: isCompact ? 72 : 240 }} transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }} className="hidden md:block h-full shrink-0 sticky top-0 border-r border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-950">
        {content}
      </motion.aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 shadow-2xl z-50">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
