import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProjectProvider, useProject } from "./context/ProjectContext";
import { ToastProvider } from "./context/ToastContext";
import { LandingPage } from "./pages/LandingPage";
import { AuthModal } from "./pages/AuthModal";
import { OnboardingModal } from "./pages/OnboardingModal";
import { OverviewPage } from "./pages/OverviewPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { RepositoryPage } from "./pages/RepositoryPage";
import { ProductGraphPage } from "./pages/ProductGraphPage";
import { SoftwareMemoryPage } from "./pages/SoftwareMemoryPage";
import { InsightsPage } from "./pages/InsightsPage";
import { ExperimentsPage } from "./pages/ExperimentsPage";
import { TimelinePage } from "./pages/TimelinePage";
import { SettingsPage } from "./pages/SettingsPage";
import { WatchPage } from "./pages/WatchPage";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { WhyDrawer } from "./components/WhyDrawer";
import { AskAfterModal } from "./components/AskAfterModal";
import { CommandPalette } from "./components/CommandPalette";
import { CreateProjectModal } from "./components/CreateProjectModal";

function MainApp() {
  const { user, loading: authLoading } = useAuth();
  const { projects, loadingProjects, currentProject } = useProject();

  const [currentView, setCurrentView] = useState<string>("overview");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

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
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-900">
      {/* Top Navbar */}
      <Navbar
        onOpenCommandPalette={() => setIsCmdPaletteOpen(true)}
        onOpenCreateProject={() => setIsCreateProjectOpen(true)}
        onNavigate={(view) => setCurrentView(view)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Dynamic Main View */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full"
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
            </motion.div>
          </AnimatePresence>
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