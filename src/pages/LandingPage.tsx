import React from "react";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  HelpCircle,
  Activity,
  History,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Github,
  Search,
  Cpu,
  Globe,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface LandingPageProps {
  onOpenAuth: (mode: "signin" | "signup") => void;
}

export function LandingPage({ onOpenAuth }: LandingPageProps) {
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-900 transition-colors">
      {/* Top minimal header */}
      <nav className="w-full max-w-7xl mx-auto px-6 h-16 flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-850">
        <div className="flex items-center space-x-2">
          <span className="font-mono font-bold tracking-tight text-lg">AFTER</span>
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 inline-block" />
        </div>

        <div className="flex items-center space-x-3">
          {/* Language toggle */}
          <button
            id="landing-language-btn"
            type="button"
            onClick={() => setLanguage(language === "pt" ? "en" : "pt")}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-850 text-xs font-mono text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            title={language === "pt" ? "Mudar para Inglês" : "Mudar para Português"}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="font-semibold uppercase">{language}</span>
          </button>

          <button
            id="landing-signin-btn"
            type="button"
            onClick={() => onOpenAuth("signin")}
            className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            {language === "pt" ? "Entrar" : "Sign in"}
          </button>
          <button
            id="landing-getstarted-btn"
            type="button"
            onClick={() => onOpenAuth("signup")}
            className="text-xs font-medium px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-all shadow-xs cursor-pointer active:scale-98"
          >
            {language === "pt" ? "Começar Agora" : "Get Started"}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="w-full max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        {/* Subtle pill */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mb-8 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {language === "pt"
              ? "Plataforma Contínua de Racional & Evolução de Software"
              : "Continuous Software Rationale & Evolution Platform"}
          </span>
        </div>

        {/* Primary proposition */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.08] text-zinc-950 dark:text-zinc-50 max-w-4xl mx-auto">
          {language === "pt"
            ? "Software que não envelhece sozinho."
            : "Software that doesn't age alone."}
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto font-normal leading-relaxed">
          {language === "pt"
            ? "Código é escrito uma vez, mas esquecido continuamente. O AFTER conecta-se aos seus repositórios reais para registrar memória institucional, saúde de dependências e deriva arquitetural silenciosa."
            : "Code is written once, but forgotten continuously. AFTER connects to your real repositories to track institutional memory, dependency health, and silent architectural drift."}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            id="hero-cta-start-btn"
            type="button"
            onClick={() => onOpenAuth("signup")}
            className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium text-sm hover:opacity-90 transition-all shadow-sm flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
          >
            <span>{language === "pt" ? "Conectar um Repositório" : "Connect a Repository"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Evidence loop indicators */}
        <div className="mt-14 pt-8 border-t border-zinc-200/50 dark:border-zinc-800/50 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
          <span>{language === "pt" ? "Observar Repositório" : "Observe Repository"}</span>
          <span>→</span>
          <span>{language === "pt" ? "Extrair Topologia" : "Extract Topology"}</span>
          <span>→</span>
          <span>{language === "pt" ? "Explicar Racional" : "Explain Rationale"}</span>
          <span>→</span>
          <span>{language === "pt" ? "Detectar Desvios" : "Detect Drift"}</span>
          <span>→</span>
          <span>{language === "pt" ? "Verificar Hipóteses" : "Verify Hypotheses"}</span>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="w-full max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
              <Github className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {language === "pt" ? "Conexão Real com Repositório" : "Real Repository Connection"}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {language === "pt"
                ? "Conecte via GitHub OAuth ou informe qualquer repositório público. O AFTER faz a varredura de arquivos reais, manifestos de pacotes e histórico Git sem inventar dados falsos."
                : "Connect via GitHub OAuth or specify any public repository. AFTER scans live files, package manifests, and git history without inventing placeholder artifacts."}
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
              <Layers className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {language === "pt" ? "Grafo de Arquitetura do Produto" : "Product Architecture Graph"}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {language === "pt"
                ? "Mapeia páginas da aplicação, componentes de UI, rotas backend, funções de lógica e dependências diretas em um grafo relacional claro."
                : "Maps your application pages, UI components, backend routes, logic functions, configuration files, and direct dependencies into a clear relational graph."}
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
              <Sparkles className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {language === "pt" ? "Racional IA Fundamentado" : "Grounded AI Rationale"}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {language === "pt"
                ? "Inspecione 'Por que isso existe?' em qualquer elemento de código. Movido no servidor pelo Gemini, distinguindo rigorosamente entre fatos CONHECIDOS, inferências e fronteiras DESCONHECIDAS."
                : 'Inspect "Why does this exist?" on any code element. Powered server-side by Gemini, strictly distinguishing between KNOWN facts, INFERRED patterns, and UNKNOWN boundaries.'}
            </p>
          </div>
        </div>
      </section>

      {/* Rationale Engine Principle */}
      <section className="w-full max-w-5xl mx-auto px-6 py-12">
        <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-8 sm:p-10 space-y-6">
          <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400">
            <Cpu className="w-4 h-4" />
            <span>{language === "pt" ? "MANDATO DE INTEGRIDADE ARQUITETURAL" : "ARCHITECTURAL INTEGRITY MANDATE"}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 max-w-2xl">
            {language === "pt"
              ? "Nunca substituir dados ausentes por dados fabricados."
              : "Never replace absent data with synthetic fabrications."}
          </h2>

          <p className="text-sm text-zinc-600 dark:text-zinc-300 max-w-2xl leading-relaxed">
            {language === "pt"
              ? "Ao contrário de ferramentas superficiais que inventam dados fictícios e tráfego simulado, o AFTER opera estritamente com base na verdade real. Se um projeto não possui eventos registrados, exibe um estado vazio. Se uma dependência não está no lockfile, ela nunca é presumida."
              : "Unlike superficial demo tools that invent fake users and simulated traffic metrics, AFTER operates strictly on ground truth. If a project has no logged events, it displays an empty timeline. If a dependency is not in your lockfile, it is never assumed."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {language === "pt" ? "CONHECIDO" : "KNOWN"}
              </span>
              <p className="text-[11px] text-zinc-500">
                {language === "pt"
                  ? "Documentado em commits git, PRs ou comentários no código fonte."
                  : "Documented in git commits, PR descriptions, or source code comments."}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {language === "pt" ? "INFERIDO" : "INFERRED"}
              </span>
              <p className="text-[11px] text-zinc-500">
                {language === "pt"
                  ? "Deduzido de chamadas, árvore de execução e grafos de dependência."
                  : "Deduced from callers, call trees, import graphs, and dependency graphs."}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {language === "pt" ? "DESCONHECIDO" : "UNKNOWN"}
              </span>
              <p className="text-[11px] text-zinc-500">
                {language === "pt"
                  ? "Explicitamente sinalizado quando a intenção histórica não está registrada."
                  : "Explicitly flagged when historical intent or telemetry is unrecorded."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-200/60 dark:border-zinc-800/80 py-10 px-6 mt-12 text-center text-xs text-zinc-400 font-mono">
        <p>{language === "pt" ? "AFTER — Software que não envelhece sozinho." : "AFTER — Software that doesn't age alone."}</p>
        <p className="mt-1 text-[11px] text-zinc-500">Built with React, TypeScript, Node.js, Firebase, and Gemini API.</p>
      </footer>
    </div>
  );
}
