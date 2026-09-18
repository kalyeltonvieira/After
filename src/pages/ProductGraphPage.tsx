import React, { useState, useEffect } from "react";
import {
  Network,
  HelpCircle,
  Layers,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  FileCode,
  FolderGit2,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { GraphNode, NodeType } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";

export function ProductGraphPage() {
  const { graphNodes, graphEdges, setSelectedNodeForWhy, currentProject } = useProject();
  const { t, language } = useLanguage();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterLayer, setFilterLayer] = useState<string>("all");

  useEffect(() => {
    if (graphNodes.length > 0 && (!selectedNode || !graphNodes.find((n) => n.id === selectedNode.id))) {
      setSelectedNode(graphNodes[0]);
    } else if (graphNodes.length === 0) {
      setSelectedNode(null);
    }
  }, [graphNodes]);

  if (!currentProject) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <EmptyState
          title={t("empty_no_project_title")}
          description={t("empty_no_project_desc")}
        />
      </div>
    );
  }

  const filteredNodes = graphNodes.filter((node) => {
    if (filterLayer === "all") return true;
    if (filterLayer === "frontend") return node.category === "frontend";
    if (filterLayer === "backend") return node.category === "backend" || node.category === "logic";
    if (filterLayer === "storage") return node.category === "storage";
    if (filterLayer === "config") return node.category === "config";
    if (filterLayer === "external") return node.category === "external";
    if (filterLayer === "experiments") return node.type === "experiment";
    return true;
  });

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case "page":
        return "📄";
      case "component":
        return "🧩";
      case "api":
        return "⚡";
      case "database":
        return "🗄️";
      case "dependency":
        return "📦";
      case "config":
        return "⚙️";
      case "experiment":
        return "🧪";
      case "function":
        return "ƒ";
      default:
        return "🔹";
    }
  };

  const getOutgoingEdges = (nodeId: string) => {
    return graphEdges.filter((e) => e.from === nodeId);
  };

  const getIncomingEdges = (nodeId: string) => {
    return graphEdges.filter((e) => e.to === nodeId);
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/70 dark:border-zinc-850">
        <div>
          <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono mb-1">
            <span>{language === "pt" ? "MAPA DE TOPOLOGIA" : "TOPOLOGY MAP"}</span>
            <span>•</span>
            <span>{currentProject.name}</span>
            <span>•</span>
            <span>{currentProject.repository}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {language === "pt" ? "Grafo de Arquitetura do Produto" : "Product Architecture Graph"}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {language === "pt"
              ? "Topologia visual mapeando entidades de código real, dependências e relacionamentos de racional. Clique em qualquer nó para inspecionar 'Por quê?'."
              : 'Visual topology mapping real code entities, dependencies, and rationale relationships. Click any node to inspect "Why?".'}
          </p>
        </div>

        {/* Filter controls */}
        {graphNodes.length > 0 && (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: language === "pt" ? "Todas as Camadas" : "All Layers" },
              { id: "frontend", label: "Frontend" },
              { id: "backend", label: language === "pt" ? "Backend & Lógica" : "Backend & Logic" },
              { id: "config", label: language === "pt" ? "Configurações" : "Config" },
              { id: "external", label: language === "pt" ? "Dependências" : "Dependencies" },
              { id: "experiments", label: language === "pt" ? "Experimentos" : "Experiments" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterLayer(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  filterLayer === tab.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {graphNodes.length === 0 ? (
        <div className="p-12 rounded-3xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-center space-y-4 max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {language === "pt" ? "Nenhuma topologia mapeada ainda" : "No architecture topology mapped yet"}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            {language === "pt"
              ? "Conecte um repositório GitHub para descobrir e mapear automaticamente páginas, componentes de UI, rotas de backend, configurações e pacotes externos sem dados falsos."
              : "Connect a GitHub repository to automatically discover and map pages, UI components, backend routes, configurations, and external packages without synthetic placeholders."}
          </p>
        </div>
      ) : (
        /* Main interactive area: Canvas + Inspector */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Visual Nodes Matrix */}
          <div className="lg:col-span-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 min-h-[480px] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono pb-4 border-b border-zinc-100 dark:border-zinc-850">
              <span>MAPPED NODES ({filteredNodes.length})</span>
              <span className="flex items-center space-x-1">
                <Info className="w-3.5 h-3.5" />
                <span>Select node to trace decisions</span>
              </span>
            </div>

            {/* Grid of Interactive Architecture Nodes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-4">
              {filteredNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const outgoing = getOutgoingEdges(node.id);

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/70 shadow-sm ring-1 ring-zinc-900/10 dark:ring-zinc-100/10"
                        : "border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/20"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">{getNodeIcon(node.type)}</span>
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[160px]">
                            {node.label}
                          </h4>
                          <span className="text-[10px] text-zinc-400 font-mono uppercase">
                            {node.category}
                          </span>
                        </div>
                      </div>
                      <StatusBadge
                        label={node.status}
                        variant={
                          node.status === "warning"
                            ? "warning"
                            : node.status === "updated"
                            ? "info"
                            : "success"
                        }
                      />
                    </div>

                    <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {node.description || "Real component mapped from repository."}
                    </p>

                    {node.filePath && (
                      <p className="mt-1 text-[10px] font-mono text-zinc-400 truncate">
                        {node.filePath}
                      </p>
                    )}

                    <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                      <span>{node.changesCount} recorded changes</span>
                      {outgoing.length > 0 && <span>{outgoing.length} connections</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Graph legend */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-850 flex flex-wrap items-center gap-4 text-[11px] text-zinc-400 font-mono">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span>Healthy</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <span>Drift / Warning</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                <span>Updated</span>
              </span>
            </div>
          </div>

          {/* Right 1 Col: Selected Node Detail & "Why?" Trigger */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 flex flex-col justify-between space-y-6">
            {selectedNode ? (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-850">
                    <span className="text-[11px] font-mono text-zinc-400 uppercase">
                      Forensic Node Inspector
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      {selectedNode.type}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {selectedNode.label}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {selectedNode.description}
                    </p>
                  </div>

                  {/* Real Code Location Reference */}
                  {selectedNode.filePath && (
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-xs space-y-1">
                      <span className="text-[10px] text-zinc-400 font-mono uppercase block">Repository Source</span>
                      <p className="font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all">
                        {selectedNode.filePath}
                      </p>
                    </div>
                  )}

                  {/* Direct Connections / Graph Relationships */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Architecture Relationships
                    </span>
                    <div className="space-y-1.5">
                      {getOutgoingEdges(selectedNode.id).map((edge, idx) => (
                        <div
                          key={idx}
                          className="text-xs p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between"
                        >
                          <span className="text-zinc-500 font-mono text-[11px]">{edge.label}</span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {edge.to}
                          </span>
                        </div>
                      ))}

                      {getIncomingEdges(selectedNode.id).map((edge, idx) => (
                        <div
                          key={`in_${idx}`}
                          className="text-xs p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between"
                        >
                          <span className="text-zinc-500 font-mono text-[11px]">invoked by</span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {edge.from}
                          </span>
                        </div>
                      ))}

                      {getOutgoingEdges(selectedNode.id).length === 0 && getIncomingEdges(selectedNode.id).length === 0 && (
                        <p className="text-[11px] text-zinc-400 italic py-1">
                          No direct cross-component dependencies declared.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-xs space-y-1">
                    <span className="text-[11px] text-zinc-400 font-mono block">Evolution Record</span>
                    <p className="text-zinc-700 dark:text-zinc-300">
                      Status: {selectedNode.lastModified || "Observed in repository"}
                    </p>
                  </div>
                </div>

                {/* Signature "Why does this exist?" Action Button */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-850 space-y-2">
                  <button
                    id="inspect-node-why-btn"
                    type="button"
                    onClick={() => setSelectedNodeForWhy(selectedNode)}
                    className="w-full py-3 px-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium text-xs hover:opacity-90 transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {language === "pt"
                        ? "Por que isso existe? (Inspecionar Racional)"
                        : "Why does this exist? (Inspect Rationale)"}
                    </span>
                  </button>
                  <p className="text-[11px] text-zinc-400 text-center">
                    {language === "pt"
                      ? "Análise de IA fundamentada distinguindo intenção CONHECIDA, INFERIDA e DESCONHECIDA."
                      : "Grounded AI analysis distinguishing KNOWN, INFERRED, and UNKNOWN intent."}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-zinc-400 text-xs">
                {language === "pt"
                  ? "Selecione qualquer nó no grafo para inspecionar seu racional."
                  : "Select any node on the graph to inspect its rationale."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
