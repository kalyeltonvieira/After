import React from "react";
import {
  FolderGit2,
  Plus,
  GitBranch,
  Code2,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";

interface ProjectsPageProps {
  onOpenCreateProject: () => void;
  onNavigate: (view: string) => void;
}

export function ProjectsPage({ onOpenCreateProject, onNavigate }: ProjectsPageProps) {
  const { projects, currentProject, setCurrentProject } = useProject();
  const { t, language } = useLanguage();

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/70 dark:border-zinc-850">
        <div>
          <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono mb-1">
            <span>{language === "pt" ? "DIRETÓRIO DE PROJETOS" : "PROJECT DIRECTORY"}</span>
            <span>•</span>
            <span>{projects.length} {language === "pt" ? "conectado(s)" : "connected"}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {language === "pt" ? "Projetos Monitorados" : "Monitored Projects"}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {language === "pt"
              ? "Repositórios, serviços e arquiteturas ativamente monitoradas pelo AFTER."
              : "Repositories, services, and architectures actively monitored by AFTER."}
          </p>
        </div>

        <button
          id="projects-create-new-btn"
          type="button"
          onClick={onOpenCreateProject}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{language === "pt" ? "Conectar Novo Projeto" : "Connect New Project"}</span>
        </button>
      </div>

      {/* Grid of Projects */}
      {projects.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-4 max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {language === "pt" ? "Nenhum projeto conectado ainda" : "No projects connected yet"}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
            {language === "pt"
              ? "Conecte um repositório GitHub para iniciar o rastreamento de dependências, drift arquitetural e racional institucional."
              : "Connect a GitHub repository to begin tracking dependencies, architectural drift, and institutional rationale."}
          </p>
          <button
            type="button"
            onClick={onOpenCreateProject}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === "pt" ? "Conectar Primeiro Projeto" : "Connect First Project"}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((proj) => {
          const isSelected = currentProject?.id === proj.id;
          return (
            <div
              key={proj.id}
              className={`p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-5 ${
                isSelected
                  ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50/50 dark:bg-zinc-900/60 shadow-xs ring-1 ring-zinc-900/10 dark:ring-zinc-100/10"
                  : "border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FolderGit2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      {proj.repository}
                    </span>
                  </div>
                  {isSelected ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[10px] font-mono uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{language === "pt" ? "Ativo" : "Active"}</span>
                    </span>
                  ) : null}
                </div>

                <div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {proj.name}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    {proj.description || (language === "pt" ? "Rastreamento contínuo de evolução de software ativo." : "Continuous software evolution tracking active.")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 font-mono pt-1">
                  <span className="flex items-center space-x-1">
                    <GitBranch className="w-3 h-3" />
                    <span>{proj.branch}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Code2 className="w-3 h-3" />
                    <span>{proj.framework}</span>
                  </span>
                  <span>{proj.language}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 font-mono">
                  {language === "pt" ? "Criado em " : "Created "}
                  {new Date(proj.createdAt).toLocaleDateString(language === "pt" ? "pt-BR" : "en-US")}
                </span>

                {isSelected ? (
                  <button
                    type="button"
                    onClick={() => onNavigate("overview")}
                    className="inline-flex items-center space-x-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                  >
                    <span>{language === "pt" ? "Abrir Visão Geral" : "Open Overview"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentProject(proj);
                      onNavigate("overview");
                    }}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {language === "pt" ? "Alternar para este projeto" : "Switch to this project"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
