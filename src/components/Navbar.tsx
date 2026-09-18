import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Search,
  Bell,
  ChevronDown,
  Plus,
  LogOut,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Laptop,
  Check,
  FolderGit2,
  Menu,
  Globe,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getInitialsAvatar } from "../lib/avatar";
import { authenticatedHeaders } from "../lib/api";

interface NavbarProps {
  onOpenCommandPalette: () => void;
  onOpenCreateProject: () => void;
  onNavigate: (view: string) => void;
  onToggleMobileSidebar: () => void;
}

export function Navbar({
  onOpenCommandPalette,
  onOpenCreateProject,
  onNavigate,
  onToggleMobileSidebar,
}: NavbarProps) {
  const { user, profile, signOut } = useAuth();
  const { projects, currentProject, setCurrentProject, insights, setIsAskAfterOpen } = useProject();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!currentProject?.id || !user) {
      setNotifications([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/repository/notifications?projectId=${encodeURIComponent(currentProject.id)}`, { headers: await authenticatedHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      } catch {
        if (!cancelled) setNotifications([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentProject?.id, user]);

  return (
    <header className="sticky top-0 z-30 w-full h-14 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/70 dark:border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between transition-colors">
      {/* Left: Mobile menu toggle + Project switcher */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="md:hidden p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand */}
        <button
          type="button"
          onClick={() => onNavigate("overview")}
          className="font-bold tracking-tight text-base text-zinc-950 dark:text-zinc-50 hover:opacity-80 transition-opacity flex items-center space-x-1.5 cursor-pointer"
        >
          <span className="tracking-tighter font-mono">AFTER</span>
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 inline-block" />
        </button>

        {/* Project Selector Dropdown */}
        <div className="relative">
          <button
            id="project-selector-dropdown-btn"
            type="button"
            onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors border border-zinc-200/60 dark:border-zinc-800 cursor-pointer"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="max-w-[140px] truncate font-medium">
              {currentProject ? currentProject.name : t("nav_select_project")}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          </button>

          {isProjectDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsProjectDropdownOpen(false)}
              />
              <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl py-1.5 z-50">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {t("nav_projects")} ({projects.length})
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        setCurrentProject(proj);
                        setIsProjectDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left transition-colors cursor-pointer"
                    >
                      <div className="truncate pr-2">
                        <p className="font-medium truncate">{proj.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate font-mono">
                          {proj.repository}
                        </p>
                      </div>
                      {currentProject?.id === proj.id && (
                        <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProjectDropdownOpen(false);
                      onOpenCreateProject();
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t("nav_create_project")}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Center: Search & Command Palette trigger */}
      <div className="hidden sm:flex items-center justify-center max-w-sm w-full mx-4">
        <button
          id="open-cmd-palette-btn"
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-855 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all cursor-pointer shadow-2xs"
        >
          <div className="flex items-center space-x-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t("nav_search_placeholder")}</span>
          </div>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0 ml-2">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Language, Ask AFTER, Notifications, Theme, User profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Language Switcher */}
        <button
          id="nav-language-toggle-btn"
          type="button"
          onClick={() => setLanguage(language === "pt" ? "en" : "pt")}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer border border-zinc-200/70 dark:border-zinc-800"
          title={language === "pt" ? "Switch to English" : "Mudar para Português (Brasil)"}
        >
          <Globe className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span className="font-mono text-[11px] uppercase tracking-wider font-bold">
            {language === "pt" ? "PT" : "EN"}
          </span>
        </button>

        {/* Ask AFTER Trigger */}
        <button
          id="nav-ask-after-btn"
          type="button"
          onClick={() => setIsAskAfterOpen(true)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity cursor-pointer shadow-xs active:scale-98"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("nav_ask_after")}</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            id="notifications-bell-btn"
            type="button"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>

          {isNotificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsNotificationsOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("nav_notifications")}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {notifications.filter((n) => !n.read).length} unread
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto py-2 space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-3 text-center">
                      {t("nav_notifications_empty")}
                    </p>
                  ) : (
                    notifications.slice(0, 4).map((notification) => (
                      <div
                        key={notification.id}
                        className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 text-xs space-y-1 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          onNavigate("insights");
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {notification.title}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1 rounded bg-zinc-200 dark:bg-zinc-700">
                            {notification.type || "repository"}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                          {notification.body || notification.evidence || "Repository event recorded."}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Theme Switcher */}
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title={`Theme: ${theme}`}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Profile Avatar & Dropdown */}
        <div className="relative">
          <button
            id="user-avatar-menu-btn"
            type="button"
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className="flex items-center space-x-2 rounded-full p-0.5 hover:ring-2 hover:ring-zinc-300 dark:hover:ring-zinc-700 transition-all cursor-pointer"
          >
            <img
              src={
                profile?.photoURL ||
                user?.photoURL ||
                getInitialsAvatar(profile?.username || user?.email || "user")
              }
              alt="Avatar"
              className="w-7 h-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 bg-zinc-100"
            />
          </button>

          {isUserDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsUserDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl py-1.5 z-50">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {profile?.displayName || user?.displayName || "User"}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">
                    @{profile?.username || "anonymous"} • {user?.email}
                  </p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      onNavigate("settings");
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{t("nav_settings")}</span>
                  </button>
                </div>

                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsUserDropdownOpen(false);
                      await signOut();
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t("nav_sign_out")}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
