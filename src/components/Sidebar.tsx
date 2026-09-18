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
} from "lucide-react";
import { motion } from "motion/react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  currentView,
  onNavigate,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { insights, experiments } = useProject();
  const { t, language } = useLanguage();

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
    { id: "settings", label: t("nav_settings"), icon: Settings },
  ];

  const content = (
    <div className="flex flex-col h-full justify-between py-5 px-3">
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

        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          {t("nav_navigation")}
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
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              className={`relative w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors duration-150 cursor-pointer ${
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
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                    isActive
                      ? "bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-800"
                      : "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Bottom Philosophy Card */}
      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/80 space-y-1.5">
        <div className="flex items-center space-x-1.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span>{language === "pt" ? "Observação Contínua" : "Continuous Observation"}</span>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans italic">
          "{language === "pt" ? "Software que não envelhece sozinho." : "Software that doesn't age alone."}"
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-60 shrink-0 border-r border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 transition-colors">
        {content}
      </aside>

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
