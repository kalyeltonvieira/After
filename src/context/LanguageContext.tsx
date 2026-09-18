import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "pt" | "en";

export interface Translations {
  [key: string]: string | undefined;

  // Common
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  close: string;
  search: string;
  loading: string;
  confirm: string;
  success: string;
  error: string;
  back: string;
  optional: string;
  required: string;

  // Navigation
  nav_overview: string;
  nav_projects: string;
  nav_graph: string;
  nav_insights: string;
  nav_experiments: string;
  nav_timeline: string;
  nav_settings: string;
  nav_navigation: string;
  nav_ask_after: string;
  nav_select_project: string;
  nav_create_project: string;
  nav_search_placeholder: string;
  nav_notifications: string;
  nav_notifications_empty: string;
  nav_sign_out: string;
  nav_my_profile: string;

  // Overview Page
  overview_title: string;
  overview_subtitle: string;
  overview_no_project_title: string;
  overview_no_project_desc: string;
  overview_connect_btn: string;
  overview_quick_actions: string;
  overview_recent_changes: string;
  overview_active_radar: string;
  overview_system_stats: string;
  overview_total_nodes: string;
  overview_active_anomalies: string;
  overview_recorded_events: string;
  overview_running_experiments: string;
  overview_view_all: string;
  overview_ask_cta: string;

  // Projects Page
  projects_title: string;
  projects_subtitle: string;
  projects_new_btn: string;
  projects_empty_title: string;
  projects_empty_desc: string;
  projects_branch: string;
  projects_framework: string;
  projects_open_btn: string;
  projects_active: string;
  projects_count: string;

  // Product Graph Page
  graph_title: string;
  graph_subtitle: string;
  graph_empty_title: string;
  graph_empty_desc: string;
  graph_filter_all: string;
  graph_filter_components: string;
  graph_filter_api: string;
  graph_filter_deps: string;
  graph_filter_storage: string;
  graph_zoom_in: string;
  graph_zoom_out: string;
  graph_reset: string;
  graph_why_btn: string;
  graph_nodes_count: string;
  graph_dependencies_count: string;

  // Insights Page
  insights_title: string;
  insights_subtitle: string;
  insights_scan_btn: string;
  insights_scanning: string;
  insights_empty_title: string;
  insights_empty_desc: string;
  insights_evidence: string;
  insights_suggested_action: string;
  insights_turn_experiment: string;
  insights_all_categories: string;

  // Experiments Page
  experiments_title: string;
  experiments_subtitle: string;
  experiments_new_btn: string;
  experiments_empty_title: string;
  experiments_empty_desc: string;
  experiments_hypothesis: string;
  experiments_control: string;
  experiments_variant: string;
  experiments_status_draft: string;
  experiments_status_running: string;
  experiments_status_concluded: string;
  experiments_approve_prod: string;
  experiments_running_badge: string;

  // Timeline Page
  timeline_title: string;
  timeline_subtitle: string;
  timeline_new_btn: string;
  timeline_empty_title: string;
  timeline_empty_desc: string;
  timeline_search_placeholder: string;
  timeline_modal_title: string;
  timeline_modal_event: string;
  timeline_modal_reason: string;
  timeline_modal_actor: string;
  timeline_modal_save: string;
  timeline_rationale_recorded: string;

  // Settings Page
  settings_title: string;
  settings_subtitle: string;
  settings_tab_profile: string;
  settings_tab_appearance: string;
  settings_tab_preferences: string;
  settings_tab_danger: string;
  settings_language: string;
  settings_language_desc: string;
  settings_lang_pt: string;
  settings_lang_en: string;
  settings_theme: string;
  settings_theme_desc: string;
  settings_theme_light: string;
  settings_theme_dark: string;
  settings_theme_system: string;
  settings_save_btn: string;
  settings_danger_delete_project: string;
  settings_danger_delete_account: string;

  // Modals & Drawers
  ask_after_title: string;
  ask_after_desc: string;
  ask_after_placeholder: string;
  ask_after_submit: string;
  why_drawer_title: string;
  why_drawer_why_exists: string;
  create_project_title: string;
  create_project_desc: string;
  create_project_tab_github: string;
  create_project_tab_manual: string;
  create_project_btn: string;

  // Landing Page
  landing_hero_title: string;
  landing_hero_subtitle: string;
  landing_cta_get_started: string;
  landing_cta_sign_in: string;
  landing_cta_sign_up: string;
  landing_tagline: string;
}

const translations: Record<Language, Translations> = {
  pt: {
    // Common
    save: "Salvar",
    cancel: "Cancelar",
    delete: "Excluir",
    edit: "Editar",
    close: "Fechar",
    search: "Buscar",
    loading: "Carregando...",
    confirm: "Confirmar",
    success: "Sucesso",
    error: "Erro",
    back: "Voltar",
    optional: "Opcional",
    required: "Obrigatório",

    // Navigation
    nav_overview: "Visão Geral",
    nav_projects: "Projetos",
    nav_graph: "Grafo do Produto",
    nav_insights: "Radar de Insights",
    nav_experiments: "Experimentos",
    nav_timeline: "Linha do Tempo",
    nav_settings: "Configurações",
    nav_navigation: "Navegação",
    nav_ask_after: "Perguntar ao AFTER",
    nav_select_project: "Selecionar Projeto",
    nav_create_project: "Criar novo projeto",
    nav_search_placeholder: "Buscar alterações, justificativas ou comandos...",
    nav_notifications: "Notificações de Telemetria",
    nav_notifications_empty: "Nada incomum detectado. Sistemas normais.",
    nav_sign_out: "Sair da conta",
    nav_my_profile: "Meu Perfil",

    // Overview Page
    overview_title: "Visão Geral do Software",
    overview_subtitle: "Telemetria contínua, topologia de arquitetura e saúde evolutiva do sistema.",
    overview_no_project_title: "Nenhum projeto conectado ainda",
    overview_no_project_desc: "Conecte um repositório GitHub para iniciar a observação do seu software, rastreando arquitetura, dependências, riscos e histórico.",
    overview_connect_btn: "Conectar Repositório",
    overview_quick_actions: "Ações Rápidas",
    overview_recent_changes: "Alterações Recentes & Justificativas",
    overview_active_radar: "Radar de Arquitetura & Riscos",
    overview_system_stats: "Métricas do Sistema",
    overview_total_nodes: "Nós de Topologia",
    overview_active_anomalies: "Anomalias Ativas",
    overview_recorded_events: "Decisões Registradas",
    overview_running_experiments: "Experimentos Ativos",
    overview_view_all: "Ver todos",
    overview_ask_cta: "Fazer uma pergunta ao AFTER sobre o sistema",

    // Projects Page
    projects_title: "Repositórios & Projetos",
    projects_subtitle: "Repositórios sob observação contínua da inteligência do AFTER.",
    projects_new_btn: "Novo Projeto",
    projects_empty_title: "Nenhum repositório conectado",
    projects_empty_desc: "Conecte um repositório GitHub ou configure um projeto manualmente para começar a mapear a arquitetura.",
    projects_branch: "Branch",
    projects_framework: "Framework",
    projects_open_btn: "Abrir Projeto",
    projects_active: "Ativo",
    projects_count: "projetos",

    // Product Graph Page
    graph_title: "Grafo do Produto & Topologia",
    graph_subtitle: "Mapeamento vivo de componentes, rotas de API, dependências externas e fluxo de dados.",
    graph_empty_title: "Nenhum componente mapeado ainda",
    graph_empty_desc: "Conecte um repositório para analisar a árvore de arquivos e dependências para gerar a topologia do software.",
    graph_filter_all: "Todos os Nós",
    graph_filter_components: "Componentes",
    graph_filter_api: "APIs & Rotas",
    graph_filter_deps: "Dependências",
    graph_filter_storage: "Armazenamento",
    graph_zoom_in: "Aproximar",
    graph_zoom_out: "Afastar",
    graph_reset: "Centralizar",
    graph_why_btn: "Por que isso existe?",
    graph_nodes_count: "nós mapeados",
    graph_dependencies_count: "dependências",

    // Insights Page
    insights_title: "Radar Contínuo & Análise de Riscos",
    insights_subtitle: "Detecção contínua de regressões, vulnerabilidades de segurança, riscos de dependência e anomalias.",
    insights_scan_btn: "Executar Varredura Forense",
    insights_scanning: "Analisando Sistema...",
    insights_empty_title: "Nenhuma anomalia ou desvio detectado",
    insights_empty_desc: "O AFTER analisa continuamente os nós de topologia e histórico de commits em busca de bugs, riscos de segurança e dependências órfãs.",
    insights_evidence: "Evidência Técnica Observada",
    insights_suggested_action: "Ação Sugerida",
    insights_turn_experiment: "Transformar em Experimento",
    insights_all_categories: "Todas",

    // Experiments Page
    experiments_title: "Laboratório de Experimentos de Software",
    experiments_subtitle: "Proponha e valide hipóteses arquiteturais com rigor científico e métricas controladas.",
    experiments_new_btn: "Estruturar Novo Experimento",
    experiments_empty_title: "Nenhum experimento registrado",
    experiments_empty_desc: "Estruture uma mudança de produto ou arquitetura para validar o impacto com segurança antes de aplicar em produção.",
    experiments_hypothesis: "Hipótese Científica",
    experiments_control: "Controle (Atual)",
    experiments_variant: "Variante Proposta",
    experiments_status_draft: "Rascunho",
    experiments_status_running: "Em Execução",
    experiments_status_concluded: "Concluído",
    experiments_approve_prod: "Aprovar para Produção",
    experiments_running_badge: "em execução",

    // Timeline Page
    timeline_title: "Livro-Razão Evolutivo & Histórico de Decisões",
    timeline_subtitle: "Histórico auditável de por que cada decisão técnica e commit foi implementado.",
    timeline_new_btn: "Registrar Justificativa",
    timeline_empty_title: "Nenhum evento histórico registrado ainda",
    timeline_empty_desc: "Conecte um repositório GitHub para importar automaticamente o histórico de commits, ou registre manualmente uma justificativa arquitetural neste livro-razão.",
    timeline_search_placeholder: "Buscar commits, justificativas, autores...",
    timeline_modal_title: "Registrar Justificativa de Decisão",
    timeline_modal_event: "Título da Alteração / Evento",
    timeline_modal_reason: "Por que essa mudança foi feita? (Justificativa técnica ou de negócio)",
    timeline_modal_actor: "Autor / Engenheiro",
    timeline_modal_save: "Gravar no Livro-Razão",
    timeline_rationale_recorded: "Justificativa Registrada",

    // Settings Page
    settings_title: "Configurações & Perfil",
    settings_subtitle: "Gerencie sua identidade, preferências de idioma, tema e configurações do projeto.",
    settings_tab_profile: "Perfil",
    settings_tab_appearance: "Aparência & Idioma",
    settings_tab_preferences: "Preferências",
    settings_tab_danger: "Zona de Perigo",
    settings_language: "Idioma da Plataforma",
    settings_language_desc: "Selecione o idioma utilizado em toda a interface do AFTER.",
    settings_lang_pt: "Português (Brasil)",
    settings_lang_en: "English (US)",
    settings_theme: "Tema Visual",
    settings_theme_desc: "Escolha entre modo claro, escuro ou sincronizado com o sistema operacional.",
    settings_theme_light: "Claro",
    settings_theme_dark: "Escuro",
    settings_theme_system: "Sistema",
    settings_save_btn: "Salvar Alterações",
    settings_danger_delete_project: "Excluir Projeto Atual",
    settings_danger_delete_account: "Excluir Minha Conta",

    // Modals & Drawers
    ask_after_title: "Pergunte ao AFTER",
    ask_after_desc: "Consulte o livro-razão de arquitetura, histórico de commits e telemetria do seu software.",
    ask_after_placeholder: "Ex: O que mudou recentemente? Existem dependências sem versão fixa?",
    ask_after_submit: "Investigar com IA",
    why_drawer_title: "Justificativa Arquitetural",
    why_drawer_why_exists: "Por que este componente existe?",
    create_project_title: "Conectar Novo Repositório",
    create_project_desc: "Importe um repositório do GitHub para iniciar o rastreamento evolutivo ou configure manualmente.",
    create_project_tab_github: "GitHub",
    create_project_tab_manual: "Manual",
    create_project_btn: "Criar & Observar",

    // Landing Page
    landing_hero_title: "Software que não envelhece sozinho.",
    landing_hero_subtitle: "O AFTER rastreia o software após a criação: arquitetura, dependências, regressões, riscos e evolução contínua inteligente.",
    landing_cta_get_started: "Começar Agora",
    landing_cta_sign_in: "Entrar",
    landing_cta_sign_up: "Criar Conta",
    landing_tagline: "Evolução Contínua de Software",

    // Page Specific Extras
    empty_no_project_title: "Nenhum projeto selecionado",
    empty_no_project_desc: "Selecione ou conecte um projeto para visualizar os dados arquiteturais.",
    empty_no_project_action: "Conectar Novo Projeto",
    overview_branch: "ramo",
    overview_scanning: "Analisando...",
    overview_scan_btn: "Escanear Agora",
    overview_health: "Saúde da Arquitetura",
    overview_health_attention: "Requer Atenção",
    overview_health_healthy: "Estável & Saudável",
    overview_arch_nodes: "Nós de Arquitetura",
    overview_nodes_desc: "Componentes, rotas e dependências",
    overview_active_insights: "Insights Ativos",
    overview_insights_desc: "Riscos ou melhorias detectadas",
    overview_experiments: "Experimentos",
    overview_experiments_desc: "Validações com hipóteses",
    overview_actionable_drift: "Drift Arquitetural e Anomalias Detectadas",
    overview_no_anomalies: "Nenhuma anomalia crítica ou drift detectado no repositório ativo.",
    overview_investigate: "Investigar Anomalia",
    overview_recent_evolution: "Linha do Tempo Evolutiva Recente",
    overview_why_exists_title: "Inspeção de Racional de Arquitetura",
    overview_why_exists_desc: "Selecione qualquer nó na topologia para descobrir por que ele foi introduzido e rastrear a intenção original.",
    overview_open_graph: "Abrir Grafo do Produto",
    insights_empty_btn: "Executar Varredura Profunda",
    insights_turn_into_experiment: "Converter em Experimento",
    timeline_ledger: "REGISTRO DE DECISÕES",
    timeline_log_btn: "Registrar Racional",
    timeline_event_title_label: "Título do Evento ou Decisão",
    timeline_why_label: "Por que esta decisão foi tomada?",
    timeline_affected_label: "Componentes Afetados",
    timeline_actor_label: "Autor / Tomador de Decisão",
    timeline_commit_label: "Hash do Commit / PR (Opcional)",
    timeline_save_btn: "Salvar no Livro-Razão",
  },
  en: {
    // Common
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    search: "Search",
    loading: "Loading...",
    confirm: "Confirm",
    success: "Success",
    error: "Error",
    back: "Back",
    optional: "Optional",
    required: "Required",

    // Navigation
    nav_overview: "Overview",
    nav_projects: "Projects",
    nav_graph: "Product Graph",
    nav_insights: "Insights Radar",
    nav_experiments: "Experiments",
    nav_timeline: "Timeline",
    nav_settings: "Settings",
    nav_navigation: "Navigation",
    nav_ask_after: "Ask AFTER",
    nav_select_project: "Select Project",
    nav_create_project: "Create new project",
    nav_search_placeholder: "Search changes, rationale or commands...",
    nav_notifications: "Live Telemetry Notifications",
    nav_notifications_empty: "Nothing unusual detected. Systems normal.",
    nav_sign_out: "Sign out",
    nav_my_profile: "My Profile",

    // Overview Page
    overview_title: "Software Health & Overview",
    overview_subtitle: "Continuous telemetry, architecture topology, and system evolutionary health.",
    overview_no_project_title: "No project connected yet",
    overview_no_project_desc: "Connect a GitHub repository to start observing your software, tracking architecture, dependencies, risks, and evolutionary history.",
    overview_connect_btn: "Connect Repository",
    overview_quick_actions: "Quick Actions",
    overview_recent_changes: "Recent Changes & Rationale",
    overview_active_radar: "Architecture & Risk Radar",
    overview_system_stats: "System Metrics",
    overview_total_nodes: "Topology Nodes",
    overview_active_anomalies: "Active Anomalies",
    overview_recorded_events: "Recorded Decisions",
    overview_running_experiments: "Running Experiments",
    overview_view_all: "View all",
    overview_ask_cta: "Ask AFTER a question about your system",

    // Projects Page
    projects_title: "Repositories & Projects",
    projects_subtitle: "Repositories under continuous observation by AFTER intelligence.",
    projects_new_btn: "New Project",
    projects_empty_title: "No repository connected yet",
    projects_empty_desc: "Connect a GitHub repository or configure a project manually to begin mapping software architecture.",
    projects_branch: "Branch",
    projects_framework: "Framework",
    projects_open_btn: "Open Project",
    projects_active: "Active",
    projects_count: "projects",

    // Product Graph Page
    graph_title: "Product Graph & Topology",
    graph_subtitle: "Living mapping of components, API endpoints, dependencies, and data flow.",
    graph_empty_title: "No components mapped yet",
    graph_empty_desc: "Connect a repository to parse dependencies and generate software topology.",
    graph_filter_all: "All Nodes",
    graph_filter_components: "Components",
    graph_filter_api: "APIs & Routes",
    graph_filter_deps: "Dependencies",
    graph_filter_storage: "Storage",
    graph_zoom_in: "Zoom In",
    graph_zoom_out: "Zoom Out",
    graph_reset: "Reset View",
    graph_why_btn: "Why does this exist?",
    graph_nodes_count: "mapped nodes",
    graph_dependencies_count: "dependencies",

    // Insights Page
    insights_title: "Continuous Radar & Risk Analysis",
    insights_subtitle: "Continuous detection of regressions, security risks, performance bottlenecks, and orphan dependencies.",
    insights_scan_btn: "Run Forensics Scan",
    insights_scanning: "Scanning System...",
    insights_empty_title: "No architecture anomalies or drift detected",
    insights_empty_desc: "AFTER continuously analyzes topology nodes and commit history for bugs, security risks, performance regressions, and unpinned dependencies.",
    insights_evidence: "Technical Evidence Observed",
    insights_suggested_action: "Suggested Action",
    insights_turn_experiment: "Turn into Experiment",
    insights_all_categories: "All",

    // Experiments Page
    experiments_title: "Software Experiments Lab",
    experiments_subtitle: "Propose and validate architectural hypotheses with scientific rigor and controlled metrics.",
    experiments_new_btn: "Structure New Experiment",
    experiments_empty_title: "No experiments registered yet",
    experiments_empty_desc: "Structure a product or architectural change to validate impact before rolling out to production.",
    experiments_hypothesis: "Scientific Hypothesis",
    experiments_control: "Control (Current)",
    experiments_variant: "Proposed Variant",
    experiments_status_draft: "Draft",
    experiments_status_running: "Running",
    experiments_status_concluded: "Concluded",
    experiments_approve_prod: "Approve for Production",
    experiments_running_badge: "running",

    // Timeline Page
    timeline_title: "Evolutionary Ledger & Decision Rationale",
    timeline_subtitle: "Auditable history of why each technical decision and commit was made.",
    timeline_new_btn: "Log Decision Rationale",
    timeline_empty_title: "No historical events recorded yet",
    timeline_empty_desc: "Connect a GitHub repository to automatically import recent commit rationale, or log an architectural decision manually into this ledger.",
    timeline_search_placeholder: "Search commits, rationale, actors...",
    timeline_modal_title: "Log Decision Rationale",
    timeline_modal_event: "Event / Change Title",
    timeline_modal_reason: "Why was this changed? (Technical/business rationale)",
    timeline_modal_actor: "Actor / Engineer",
    timeline_modal_save: "Record into Ledger",
    timeline_rationale_recorded: "Rationale Recorded",

    // Settings Page
    settings_title: "Settings & Profile",
    settings_subtitle: "Manage your account identity, theme preferences, and project configurations.",
    settings_tab_profile: "Profile",
    settings_tab_appearance: "Appearance & Language",
    settings_tab_preferences: "Preferences",
    settings_tab_danger: "Danger Zone",
    settings_language: "Platform Language",
    settings_language_desc: "Select the interface language for AFTER.",
    settings_lang_pt: "Português (Brasil)",
    settings_lang_en: "English (US)",
    settings_theme: "Interface Theme",
    settings_theme_desc: "Choose between light mode, dark mode, or system default.",
    settings_theme_light: "Light",
    settings_theme_dark: "Dark",
    settings_theme_system: "System",
    settings_save_btn: "Save Changes",
    settings_danger_delete_project: "Delete Current Project",
    settings_danger_delete_account: "Delete My Account",

    // Modals & Drawers
    ask_after_title: "Ask AFTER",
    ask_after_desc: "Query your software's architecture ledger, commit history, and live telemetry.",
    ask_after_placeholder: "e.g. What changed recently? Are there unpinned dependencies?",
    ask_after_submit: "Investigate with AI",
    why_drawer_title: "Architectural Rationale",
    why_drawer_why_exists: "Why does this exist?",
    create_project_title: "Connect New Repository",
    create_project_desc: "Import a GitHub repository to start evolutionary tracking or configure manually.",
    create_project_tab_github: "GitHub",
    create_project_tab_manual: "Manual",
    create_project_btn: "Create & Observe",

    // Landing Page
    landing_hero_title: "Software that doesn't age alone.",
    landing_hero_subtitle: "AFTER tracks software after creation: architecture, dependencies, regressions, risks, and intelligent evolution.",
    landing_cta_get_started: "Get Started",
    landing_cta_sign_in: "Sign In",
    landing_cta_sign_up: "Sign Up",
    landing_tagline: "Continuous Software Evolution",

    // Page Specific Extras
    empty_no_project_title: "No project selected",
    empty_no_project_desc: "Select or connect a project to view architectural data.",
    empty_no_project_action: "Connect New Project",
    overview_branch: "branch",
    overview_scanning: "Scanning...",
    overview_scan_btn: "Scan Now",
    overview_health: "Architecture Health",
    overview_health_attention: "Attention Required",
    overview_health_healthy: "Stable & Healthy",
    overview_arch_nodes: "Architecture Nodes",
    overview_nodes_desc: "Components, routes & dependencies",
    overview_active_insights: "Active Insights",
    overview_insights_desc: "Risks or opportunities detected",
    overview_experiments: "Experiments",
    overview_experiments_desc: "Hypothesis-driven validations",
    overview_actionable_drift: "Actionable Drift & Detected Anomalies",
    overview_no_anomalies: "No critical anomalies or architectural drift detected on active repository.",
    overview_investigate: "Investigate Anomaly",
    overview_recent_evolution: "Recent Evolution Ledger",
    overview_why_exists_title: "Architecture Rationale Inspection",
    overview_why_exists_desc: "Select any node in the topology to understand why it was introduced and trace original intent.",
    overview_open_graph: "Open Product Graph",
    insights_empty_btn: "Trigger Deep Analysis",
    insights_turn_into_experiment: "Convert into Experiment",
    timeline_ledger: "DECISION LEDGER",
    timeline_log_btn: "Log Rationale",
    timeline_event_title_label: "Event or Decision Title",
    timeline_why_label: "Why was this decision made?",
    timeline_affected_label: "Affected Components",
    timeline_actor_label: "Author / Decision Maker",
    timeline_commit_label: "Commit Hash / PR (Optional)",
    timeline_save_btn: "Save to Ledger",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = "after_preferred_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Check localStorage first
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "pt" || saved === "en") {
      return saved;
    }
    // Default to Portuguese since the user explicitly requested Portuguese, or check browser
    const browserLang = typeof navigator !== "undefined" ? navigator.language : "";
    if (browserLang.toLowerCase().startsWith("pt")) {
      return "pt";
    }
    // Default to Portuguese per user request
    return "pt";
  });

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = newLang === "pt" ? "pt-BR" : "en";
    }
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
    }
  }, [language]);

  const t = (key: string): string => {
    return translations[language]?.[key] || translations.en?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
