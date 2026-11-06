import React, { lazy, Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProjectProvider, useProject } from "./context/ProjectContext";
import { ToastProvider } from "./context/ToastContext";
import { LandingPage } from "./pages/LandingPage";
import { AuthModal } from "./pages/AuthModal";
import { OnboardingModal } from "./pages/OnboardingModal";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { WhyDrawer } from "./components/WhyDrawer";
import { AskAfterModal } from "./components/AskAfterModal";
import { CommandPalette } from "./components/CommandPalette";
import { CreateProjectModal } from "./components/CreateProjectModal";

const OverviewPage = lazy(() => import("./pages/OverviewPage").then((m) => ({ default: m.OverviewPage })));
const RepositoryPage = lazy(() => import("./pages/RepositoryPage").then((m) => ({ default: m.RepositoryPage })));
const ProductGraphPage = lazy(() => import("./pages/ProductGraphPage").then((m) => ({ default: m.ProductGraphPage })));
const SoftwareMemoryPage = lazy(() => import("./pages/SoftwareMemoryPage").then((m) => ({ default: m.SoftwareMemoryPage })));
const InsightsPage = lazy(() => import("./pages/InsightsPage").then((m) => ({ default: m.InsightsPage })));
const ExperimentsPage = lazy(() => import("./pages/ExperimentsPage").then((m) => ({ default: m.ExperimentsPage })));
const TimelinePage = lazy(() => import("./pages/TimelinePage").then((m) => ({ default: m.TimelinePage })));
const WatchPage = lazy(() => import("./pages/WatchPage").then((m) => ({ default: m.WatchPage })));
const ArchitectureComparePage = lazy(() => import("./pages/ArchitectureComparePage").then((m) => ({ default: m.ArchitectureComparePage })));
const ExecutiveReportPage = lazy(() => import("./pages/ExecutiveReportPage").then((m) => ({ default: m.ExecutiveReportPage })));

function MainApp() {
  const { user, loading: authLoading } = useAuth();
  const { projects, loadingProjects, currentProject } = useProject();

  const [currentView, setCurrentView] = useState<string>("overview");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  useEffect(() => {
    const press = (event: PointerEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "button:not(:disabled), [role=\"button\"], a.inline-flex, a.flex"
      );
      if (!target) return;
      target.classList.remove("after-pressing");
      void target.offsetWidth;
      target.classList.add("after-pressing");
      window.setTimeout(() => target.classList.remove("after-pressing"), 380);
    };

    document.addEventListener("pointerdown", press, { passive: true });
    return () => document.removeEventListener("pointerdown", press);
  }, []);

  useEffect(() => {
    const handleSidebarShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select, [contenteditable=\"true\"]");
      if (isTyping || event.key.toLowerCase() !== "b" || (!event.ctrlKey && !event.metaKey) || event.altKey) return;

      event.preventDefault();
      setIsSidebarCollapsed((collapsed) => !collapsed);
    };

    window.addEventListener("keydown", handleSidebarShortcut);
    return () => window.removeEventListener("keydown", handleSidebarShortcut);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <span className="font-mono font-bold tracking-tighter text-2xl text-zinc-950 dark:text-zinc-50 animate-pulse">
          AFTER
        </span>
        <p className="text-xs text-zinc-400 font-mono">Initializing platform...</p>
      </div>
    );
  }

  // Not logged in: Show pristine Landing Page
  if (!user) {
    return (
      <>
        <LandingPage
          onOpenAuth={(mode) => {
            setAuthModalMode(mode);
            setIsAuthModalOpen(true);
          }}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          defaultMode={authModalMode}
        />
      </>
    );
  }

  return (
    <div className="after-surface h-screen max-h-screen overflow-hidden bg-[#fafafa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-900">
      {/* Top Navbar */}
      <Navbar
        onOpenCommandPalette={() => setIsCmdPaletteOpen(true)}
        onOpenCreateProject={() => setIsCreateProjectOpen(true)}
        onNavigate={(view) => setCurrentView(view)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
      />

      {/* Main Body */}
      <div className="flex-1 min-h-0 h-[calc(100vh-3.5rem)] flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        />

        {/* Dynamic Main View */}
        <main className="min-w-0 min-h-0 flex-1 h-full overflow-x-hidden overflow-y-auto overscroll-y-contain transition-[padding] duration-300 ease-out">
          <Suspense fallback={<div className="p-8 text-xs text-zinc-500 font-mono">Loading view…</div>}>
            <AnimatePresence mode="wait">
              <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full min-h-full"
            >
              {currentView === "overview" && (
                <OverviewPage
                  onNavigate={(view) => setCurrentView(view)}
                  onOpenCreateProject={() => setIsCreateProjectOpen(true)}
                />
              )}

              {currentView === "repository" && <RepositoryPage />}

              {currentView === "projects" && (
                <ProjectsPage
                  onOpenCreateProject={() => setIsCreateProjectOpen(true)}
                  onNavigate={(view) => setCurrentView(view)}
                />
              )}

              {currentView === "graph" && <ProductGraphPage />}

              {currentView === "memory" && <SoftwareMemoryPage />}

              {currentView === "insights" && (
                <InsightsPage onNavigate={(view) => setCurrentView(view)} />
              )}

              {currentView === "experiments" && <ExperimentsPage />}

              {currentView === "timeline" && <TimelinePage />}

              {currentView === "settings" && <SettingsPage />}

              {currentView === "watch" && <WatchPage />}

              {currentView === "compare" && <ArchitectureComparePage />}

              {currentView === "report" && <ExecutiveReportPage />}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>

      {/* Global Drawers & Modals */}
      <WhyDrawer />
      <AskAfterModal />
      <CommandPalette
        isOpen={isCmdPaletteOpen}
        onOpen={() => setIsCmdPaletteOpen(true)}
        onClose={() => setIsCmdPaletteOpen(false)}
        onNavigate={(view) => setCurrentView(view)}
        openCreateProject={() => setIsCreateProjectOpen(true)}
      />
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode={authModalMode}
      />
      <OnboardingModal />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ProjectProvider>
            <ToastProvider>
              <MainApp />
            </ToastProvider>
          </ProjectProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
