import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Brain,
  Crosshair,
  Database,
  FileCode2,
  Filter,
  FolderTree,
  GitBranch,
  Layers3,
  Maximize2,
  Minus,
  Network,
  Plus,
  Search,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";
import { authenticatedHeaders } from "../lib/api";
import { EmptyState } from "../components/EmptyState";
import type { GraphEdge, GraphNode, NodeType } from "../types";

type ViewMode = "architecture" | "dependencies" | "files" | "unified";
type Point = { x: number; y: number };
type UnifiedEntity = { id: string; label: string; type: "repository" | "code" | "collaborator" | "activity" | "dependency"; subtitle: string; color: string; source?: GraphNode };

const nodeColors: Record<string, string> = {
  repository: "#f59e0b",
  directory: "#f59e0b",
  file: "#38bdf8",
  component: "#a78bfa",
  page: "#c084fc",
  function: "#22c55e",
  class: "#34d399",
  api: "#fb7185",
  service: "#fb7185",
  database: "#f97316",
  dependency: "#60a5fa",
  config: "#94a3b8",
  experiment: "#e879f9",
};

const layerForNode = (node: GraphNode) => {
  if (["repository", "directory"].includes(node.type)) return "Structure";
  if (["database", "dependency", "config"].includes(node.type)) return "Infrastructure";
  if (["api", "service"].includes(node.type)) return "Backend";
  if (["page", "component"].includes(node.type)) return "Frontend";
  return "Logic";
};

const shortLabel = (value: string, size = 22) => value.length > size ? `${value.slice(0, size - 1)}…` : value;

function nodeIcon(type: NodeType) {
  if (["repository", "directory"].includes(type)) return FolderTree;
  if (["database"].includes(type)) return Database;
  if (["dependency", "config"].includes(type)) return Layers3;
  if (["api", "service"].includes(type)) return Zap;
  if (["function", "class"].includes(type)) return GitBranch;
  return FileCode2;
}

function edgeKey(edge: GraphEdge, index: number) {
  return `${edge.from}:${edge.to}:${edge.label || "edge"}:${index}`;
}

export function ProjectGraphPage() {
  const {
    currentProject,
    graphNodes,
    graphEdges,
    setAiContext,
    setIsAskAfterOpen,
    setSelectedNodeForWhy,
  } = useProject();
  const { language } = useLanguage();
  const [mode, setMode] = useState<ViewMode>("architecture");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.82);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [focusOnly, setFocusOnly] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impact, setImpact] = useState<any>(null);
  const [dragging, setDragging] = useState<{ id: string; start: Point; origin: Point } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const nodes = useMemo(() => {
    const seen = new Set<string>();
    return (graphNodes || []).filter((node) => node?.id && !seen.has(node.id) && Boolean(seen.add(node.id)));
  }, [graphNodes]);
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = selectedId ? nodeMap.get(selectedId) || null : nodes[0] || null;

  const unifiedEntities = useMemo<UnifiedEntity[]>(() => {
    const repository: UnifiedEntity = { id: "unified:repository", label: currentProject?.name || currentProject?.repository || "Repository", type: "repository", subtitle: currentProject?.repository || "Project repository", color: "#f59e0b" };
    const code = nodes.filter((node) => ["file", "component", "page", "function", "class", "api", "service"].includes(node.type)).slice(0, 80).map((node) => ({ id: `unified:code:${node.id}`, label: node.label, type: "code" as const, subtitle: node.filePath || node.type, color: nodeColors[node.type] || "#38bdf8", source: node }));
    const dependencies = nodes.filter((node) => ["dependency", "database", "config"].includes(node.type)).slice(0, 40).map((node) => ({ id: `unified:dependency:${node.id}`, label: node.label, type: "dependency" as const, subtitle: node.filePath || node.type, color: nodeColors[node.type] || "#60a5fa", source: node }));
    const collaborators = [...new Set((currentProject?.events || []).map((event) => event.actor).filter(Boolean))].slice(0, 30).map((actor) => ({ id: `unified:collaborator:${actor}`, label: actor, type: "collaborator" as const, subtitle: "Contributor", color: "#a78bfa" }));
    const activity = (currentProject?.events || []).slice(0, 30).map((event) => ({ id: `unified:activity:${event.id}`, label: event.event || "Repository activity", type: "activity" as const, subtitle: event.reason || event.timestamp, color: "#22c55e" }));
    return [repository, ...code, ...dependencies, ...collaborators, ...activity];
  }, [currentProject, nodes]);

  useEffect(() => {
    if (!selectedId && nodes[0]) setSelectedId(nodes[0].id);
    if (selectedId && !nodeMap.has(selectedId)) setSelectedId(nodes[0]?.id || null);
  }, [nodes, selectedId, nodeMap]);

  const types = useMemo(() => [...new Set(nodes.map((node) => node.type))].sort(), [nodes]);
  const filteredNodes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = nodes.filter((node) => {
      const matchesQuery = !normalized || [node.label, node.filePath, node.description, node.dependency].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized));
      const matchesType = typeFilter === "all" || node.type === typeFilter;
      const matchesMode = mode === "architecture"
        ? true
        : mode === "dependencies" ? ["dependency", "api", "service", "database"].includes(node.type)
        : ["file", "directory", "repository", "component", "page", "function", "class"].includes(node.type);
      return matchesQuery && matchesType && matchesMode;
    });
    if (!focusOnly || !selectedNode) return result;
    const neighborhood = new Set([selectedNode.id, ...graphEdges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id).flatMap((edge) => [edge.from, edge.to])]);
    return result.filter((node) => neighborhood.has(node.id));
  }, [nodes, query, typeFilter, mode, focusOnly, selectedNode, graphEdges]);

  const positions = useMemo(() => {
    const layers = mode === "dependencies"
      ? ["Frontend", "Backend", "Infrastructure"]
      : ["Structure", "Frontend", "Backend", "Logic", "Infrastructure"];
    const grouped = new Map<string, GraphNode[]>();
    for (const layer of layers) grouped.set(layer, []);
    for (const node of filteredNodes) {
      const layer = layerForNode(node);
      if (!grouped.has(layer)) grouped.set(layer, []);
      grouped.get(layer)!.push(node);
    }
    const result = new Map<string, Point>();
    const columnWidth = 255;
    for (const [column, layer] of layers.entries()) {
      const group = grouped.get(layer) || [];
      group.forEach((node, row) => result.set(node.id, { x: 140 + column * columnWidth, y: 92 + row * 86 }));
    }
    return result;
  }, [filteredNodes, mode]);
  const [manualPositions, setManualPositions] = useState<Map<string, Point>>(new Map());
  const graphPositions = useMemo(() => new Map([...positions, ...manualPositions]), [positions, manualPositions]);
  const canvasWidth = Math.max(1120, (mode === "dependencies" ? 3 : 5) * 255 + 180);
  const canvasHeight = Math.max(560, Math.max(1, ...[...graphPositions.values()].map((point) => point.y + 80)));
  const unifiedPositions = useMemo(() => {
    const result = new Map<string, Point>();
    const columns: UnifiedEntity["type"][] = ["repository", "code", "dependency", "collaborator", "activity"];
    for (const [column, type] of columns.entries()) unifiedEntities.filter((entity) => entity.type === type).forEach((entity, row) => result.set(entity.id, { x: 145 + column * 225, y: 100 + row * 82 }));
    return result;
  }, [unifiedEntities]);
  const unifiedConnections = useMemo(() => {
    const connections: Array<{ from: string; to: string; label: string }> = [];
    const codeBySource = new Map(nodes.map((node) => [node.id, `unified:code:${node.id}`]));
    unifiedEntities.filter((entity) => entity.type === "code").forEach((entity) => connections.push({ from: "unified:repository", to: entity.id, label: "contains" }));
    unifiedEntities.filter((entity) => entity.type === "dependency").forEach((entity) => connections.push({ from: "unified:repository", to: entity.id, label: "uses" }));
    for (const edge of graphEdges) {
      const from = codeBySource.get(edge.from);
      const to = codeBySource.get(edge.to);
      if (from && to) connections.push({ from, to, label: edge.label || "related" });
    }
    const collaborators = new Map<string, string>();
    for (const entity of unifiedEntities.filter((item) => item.type === "collaborator")) collaborators.set(entity.label, entity.id);
    for (const event of currentProject?.events || []) {
      const collaborator = collaborators.get(event.actor);
      const activity = `unified:activity:${event.id}`;
      if (collaborator && unifiedPositions.has(activity)) connections.push({ from: collaborator, to: activity, label: event.event || "activity" });
    }
    return connections;
  }, [currentProject?.events, graphEdges, nodes, unifiedEntities, unifiedPositions]);

  const visibleEdges = useMemo(() => graphEdges.filter((edge) => graphPositions.has(edge.from) && graphPositions.has(edge.to)), [graphEdges, graphPositions]);
  const connectedIds = useMemo(() => {
    if (!selectedNode) return new Set(filteredNodes.map((node) => node.id));
    return new Set([selectedNode.id, ...visibleEdges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id).flatMap((edge) => [edge.from, edge.to])]);
  }, [selectedNode, visibleEdges, filteredNodes]);

  const resetView = () => { setZoom(0.82); setPan({ x: 0, y: 0 }); setManualPositions(new Map()); };
  const selectNode = (node: GraphNode) => { setSelectedId(node.id); setImpact(null); };
  const inspectImpact = async () => {
    if (!selectedNode || !currentProject) return;
    setImpactLoading(true);
    try {
      const response = await fetch("/api/projects/impact", { method: "POST", headers: await authenticatedHeaders(), body: JSON.stringify({ projectId: currentProject.id, nodeId: selectedNode.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Impact analysis failed");
      setImpact(body);
    } catch (error) { setImpact({ error: error instanceof Error ? error.message : String(error) }); }
    finally { setImpactLoading(false); }
  };
  const openRationale = () => {
    if (!selectedNode) return;
    setAiContext({ type: selectedNode.filePath ? "file" : "node", label: selectedNode.filePath || selectedNode.label, path: selectedNode.filePath });
    setSelectedNodeForWhy(selectedNode);
  };
  const openChat = () => {
    if (!selectedNode) return;
    setAiContext({ type: selectedNode.filePath ? "file" : "node", label: selectedNode.filePath || selectedNode.label, path: selectedNode.filePath });
    setIsAskAfterOpen(true);
  };

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-graph-node]")) return;
    const start = { x: event.clientX, y: event.clientY };
    const origin = pan;
    const move = (moveEvent: PointerEvent) => setPan({ x: origin.x + moveEvent.clientX - start.x, y: origin.y + moveEvent.clientY - start.y });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const onNodePointerDown = (event: React.PointerEvent<SVGGElement>, node: GraphNode) => {
    event.stopPropagation();
    setDragging({ id: node.id, start: { x: event.clientX, y: event.clientY }, origin: graphPositions.get(node.id) || { x: 0, y: 0 } });
    selectNode(node);
  };
  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => setManualPositions((current) => new Map(current).set(dragging.id, { x: dragging.origin.x + (event.clientX - dragging.start.x) / zoom, y: dragging.origin.y + (event.clientY - dragging.start.y) / zoom }));
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [dragging, zoom]);

  if (!currentProject) return <div className="p-8 max-w-4xl mx-auto"><EmptyState title="Nenhum projeto conectado" description="Conecte um repositório para visualizar sua arquitetura." /></div>;

  return (
    <div className="p-5 sm:p-8 max-w-[1800px] mx-auto space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-sky-500 font-mono"><Network className="w-3.5 h-3.5" /> Project Graph · {currentProject.repository}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Mapa arquitetural do projeto</h1>
          <p className="mt-1 max-w-2xl text-xs text-zinc-500 dark:text-zinc-400">Explore estrutura, dependências, fluxos e relações reais descobertas no código. O Grafo do Produto continua disponível separadamente.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["architecture", "dependencies", "files", "unified"] as ViewMode[]).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`px-3 py-2 rounded-xl text-[11px] font-medium border transition-colors ${mode === item ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>{item === "architecture" ? "Arquitetura" : item === "dependencies" ? "Dependências" : item === "files" ? "Arquivos" : "Unified Nodes"}</button>)}
        </div>
      </div>

      {nodes.length === 0 ? <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center"><Network className="mx-auto w-8 h-8 text-zinc-400" /><h2 className="mt-4 font-semibold">Grafo ainda não mapeado</h2><p className="mt-2 text-xs text-zinc-500">Execute a análise do repositório para gerar nós e relacionamentos reais.</p></div> : <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[{ label: "Nós mapeados", value: nodes.length, icon: Target }, { label: "Relações", value: graphEdges.length, icon: GitBranch }, { label: "Arquivos", value: nodes.filter((node) => node.type === "file").length, icon: FileCode2 }, { label: "Dependências", value: nodes.filter((node) => node.type === "dependency").length, icon: Layers3 }].map((stat) => <div key={stat.label} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 p-4"><stat.icon className="w-4 h-4 text-sky-500" /><div className="mt-3 text-2xl font-semibold">{stat.value}</div><div className="text-[10px] uppercase tracking-wider text-zinc-400">{stat.label}</div></div>)}
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_350px] gap-4">
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-zinc-800">
              <div className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nó, arquivo ou dependência…" className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-9 pr-3 py-2 text-xs text-zinc-200 outline-none focus:border-sky-500" /></div>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300"><option value="all">Todos os tipos</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select>
              <button type="button" onClick={() => setFocusOnly((value) => !value)} disabled={!selectedNode} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs disabled:opacity-40 ${focusOnly ? "border-sky-500 bg-sky-500/10 text-sky-300" : "border-zinc-800 text-zinc-400"}`}><Crosshair className="w-3.5 h-3.5" /> Foco</button>
              <button type="button" onClick={resetView} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-400"><Maximize2 className="w-3.5 h-3.5" /> Resetar</button>
              <div className="flex items-center gap-1 ml-auto"><button type="button" onClick={() => setZoom((value) => Math.max(0.45, value - 0.1))} className="p-2 rounded-lg border border-zinc-800 text-zinc-400"><Minus className="w-3.5 h-3.5" /></button><span className="w-12 text-center font-mono text-[10px] text-zinc-500">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))} className="p-2 rounded-lg border border-zinc-800 text-zinc-400"><Plus className="w-3.5 h-3.5" /></button></div>
            </div>
            <div ref={viewportRef} onPointerDown={onCanvasPointerDown} className="relative h-[min(72vh,820px)] overflow-hidden cursor-grab active:cursor-grabbing bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:22px_22px]">
              <div className="absolute left-4 top-4 z-10 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-[10px] text-zinc-400 backdrop-blur"><div>{mode === "unified" ? `${unifiedEntities.length} entidades · ${unifiedConnections.length} conexões` : `${filteredNodes.length} nós visíveis · ${visibleEdges.length} conexões`}</div><div className="mt-1 text-zinc-600">Arraste o canvas ou um nó · use Foco para isolar caminhos</div></div>
              <svg width={canvasWidth * zoom} height={canvasHeight * zoom} viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, transformOrigin: "0 0" }} className="absolute left-0 top-0 overflow-visible transition-transform duration-150" opacity={mode === "unified" ? 0 : 1}>
                <defs><marker id="project-graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" /></marker></defs>
                {["Structure", "Frontend", "Backend", "Logic", "Infrastructure"].map((layer, index) => <g key={layer}><rect x={35 + index * 255} y={28} width={210} height={canvasHeight - 55} rx={18} fill="rgba(24,24,27,0.42)" stroke="rgba(63,63,70,0.55)" /><text x={55 + index * 255} y={55} fill="#71717a" fontSize="10" fontWeight="600" letterSpacing="2">{layer.toUpperCase()}</text></g>)}
                {visibleEdges.map((edge, index) => { const from = graphPositions.get(edge.from)!; const to = graphPositions.get(edge.to)!; const highlighted = selectedNode && (edge.from === selectedNode.id || edge.to === selectedNode.id); return <g key={edgeKey(edge, index)} opacity={selectedNode && !highlighted ? 0.12 : 0.72}><path d={`M ${from.x + 72} ${from.y + 22} C ${(from.x + to.x) / 2} ${from.y + 22}, ${(from.x + to.x) / 2} ${to.y + 22}, ${to.x - 72} ${to.y + 22}`} fill="none" stroke={highlighted ? "#38bdf8" : "#64748b"} strokeWidth={highlighted ? 2.4 : 1.2} markerEnd="url(#project-graph-arrow)" /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 + 14} textAnchor="middle" fill="#71717a" fontSize="8">{edge.label || "related"}</text></g>; })}
                {filteredNodes.map((node) => { const point = graphPositions.get(node.id); if (!point) return null; const color = nodeColors[node.type] || "#94a3b8"; const Icon = nodeIcon(node.type); const active = selectedNode?.id === node.id; const connected = connectedIds.has(node.id); return <g key={node.id} data-graph-node="true" transform={`translate(${point.x} ${point.y})`} onPointerDown={(event) => onNodePointerDown(event, node)} onDoubleClick={() => { if (node.filePath) setAiContext({ type: "file", label: node.filePath, path: node.filePath }); }} opacity={connected ? 1 : 0.18} className="cursor-pointer"><rect x={-72} y={-1} width={144} height={47} rx={12} fill={active ? "#172554" : "#18181b"} stroke={active ? "#38bdf8" : color} strokeWidth={active ? 2.4 : 1.2} /><circle cx={-53} cy={22} r={12} fill={`${color}22`} stroke={color} /><foreignObject x={-60} y={15} width={14} height={14}><Icon width={14} height={14} color={color} /></foreignObject><text x={-34} y={19} fill="#f4f4f5" fontSize="10" fontWeight="600">{shortLabel(node.label)}</text><text x={-34} y={34} fill="#71717a" fontSize="8">{node.type}{node.filePath ? ` · ${shortLabel(node.filePath, 20)}` : ""}</text></g>; })}
              </svg>
              {mode === "unified" && <svg width={1450 * zoom} height={Math.max(620, 130 + Math.max(1, ...[...unifiedPositions.values()].map((point) => point.y + 85))) * zoom} viewBox="0 0 1450 900" style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, transformOrigin: "0 0" }} className="absolute left-0 top-0 overflow-visible transition-transform duration-150">
                <defs><marker id="unified-node-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" /></marker></defs>
                {unifiedConnections.map((connection, index) => { const from = unifiedPositions.get(connection.from); const to = unifiedPositions.get(connection.to); if (!from || !to) return null; return <g key={`${connection.from}:${connection.to}:${index}`}><path d={`M ${from.x + 86} ${from.y + 20} C ${(from.x + to.x) / 2} ${from.y + 20}, ${(from.x + to.x) / 2} ${to.y + 20}, ${to.x - 86} ${to.y + 20}`} fill="none" stroke="#52525b" strokeWidth="1.8" strokeDasharray={connection.label === "contains" ? "0" : "6 5"} markerEnd="url(#unified-node-arrow)" /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5} fill="#a1a1aa" fontSize="8" textAnchor="middle">{connection.label}</text></g>; })}
                {unifiedEntities.map((entity) => { const point = unifiedPositions.get(entity.id); if (!point) return null; const active = entity.source?.id === selectedNode?.id; return <g key={entity.id} data-graph-node="true" transform={`translate(${point.x} ${point.y})`} onPointerDown={(event) => { event.stopPropagation(); if (entity.source) selectNode(entity.source); }} className="cursor-pointer"><rect x={-86} y={-2} width={172} height={48} rx={5} fill={active ? "#172554" : "#27272a"} stroke={active ? "#38bdf8" : entity.color} strokeWidth={active ? 2.5 : 1.2} /><rect x={-86} y={-2} width={172} height={16} rx={5} fill={`${entity.color}cc`} /><text x={0} y={9} fill="#18181b" fontSize="9" fontWeight="700" textAnchor="middle">{shortLabel(entity.label, 25)}</text><circle cx={-86} cy={21} r={5} fill={entity.color} /><text x={-73} y={28} fill="#f4f4f5" fontSize="8">{entity.type}</text><text x={-73} y={39} fill="#a1a1aa" fontSize="7">{shortLabel(entity.subtitle, 26)}</text><circle cx={86} cy={21} r={5} fill="#d97706" /></g>; })}
              </svg>}
              <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-2 backdrop-blur">{Object.entries(nodeColors).slice(0, 8).map(([type, color]) => <span key={type} className="flex items-center gap-1 text-[9px] text-zinc-500"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{type}</span>)}</div>
            </div>
          </section>

          <aside className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 min-h-[520px]">
            {!selectedNode ? <div className="h-full flex items-center justify-center text-xs text-zinc-400">Selecione um nó para inspecionar.</div> : <div className="space-y-5">
              <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.18em] text-sky-500 font-mono">Node inspector</div><h2 className="mt-2 text-xl font-semibold break-words">{selectedNode.label}</h2></div><button type="button" onClick={() => setSelectedId(null)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="w-4 h-4" /></button></div>
              <div className="flex flex-wrap gap-2"><span className="rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ color: nodeColors[selectedNode.type], backgroundColor: `${nodeColors[selectedNode.type] || "#94a3b8"}18` }}>{selectedNode.type}</span><span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-500">{layerForNode(selectedNode)}</span><span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-500">{selectedNode.status}</span></div>
              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{selectedNode.description || "Entidade observada na análise real do repositório."}</p>
              {selectedNode.filePath && <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-3"><div className="text-[10px] uppercase tracking-wider text-zinc-400">Fonte</div><div className="mt-1 break-all font-mono text-[11px]">{selectedNode.filePath}{selectedNode.line ? `:${selectedNode.line}` : ""}</div></div>}
              <div><div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-400"><span>Relações diretas</span><span>{visibleEdges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id).length}</span></div><div className="max-h-52 space-y-1.5 overflow-auto">{visibleEdges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id).slice(0, 30).map((edge, index) => { const targetId = edge.from === selectedNode.id ? edge.to : edge.from; const target = nodeMap.get(targetId); return <button key={edgeKey(edge, index)} type="button" onClick={() => target && selectNode(target)} className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 p-2 text-left hover:border-sky-400"><div className="flex items-center gap-2 text-[10px] text-zinc-400"><ArrowRight className="w-3 h-3 text-sky-500" />{edge.label || "related"}</div><div className="mt-1 truncate text-xs font-medium">{target?.label || targetId}</div><div className="mt-1 truncate text-[9px] text-zinc-500">{edge.evidence || "Evidence recorded by repository analysis."}</div></button>; })}{visibleEdges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id).length === 0 && <div className="text-xs text-zinc-400">Nenhuma relação direta registrada.</div>}</div></div>
              {impact && <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30 p-3 text-xs text-sky-900 dark:text-sky-200">{impact.error ? impact.error : `${impact.directDependents?.length || 0} dependentes diretos · ${impact.transitiveDependents?.length || 0} transitivos`}</div>}
              <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-4"><button type="button" onClick={() => void inspectImpact()} disabled={impactLoading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-xs font-medium disabled:opacity-50"><Target className="w-3.5 h-3.5" />{impactLoading ? "Analisando impacto…" : "Analisar impacto"}</button><button type="button" onClick={openRationale} className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 py-2.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"><Sparkles className="w-3.5 h-3.5" />Inspecionar racional</button><button type="button" onClick={openChat} className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-xs"><Brain className="w-3.5 h-3.5" />Conversar com AFTER</button></div>
            </div>}
          </aside>
        </div>
      </>}
    </div>
  );
}
