/**
 * AFTER Graph Analysis & Impact Assessment Engine
 * Computes direct and transitive dependencies, blast radius,
 * affected tests, APIs, and configuration files with real evidence.
 */

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  filePath?: string;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  from: string;
  to: string;
  relationship?: string;
  evidence?: string | string[];
}

export interface ImpactAssessment {
  node: GraphNode;
  directDependents: GraphEdge[];
  directDependencies: GraphEdge[];
  transitiveDependentIds: string[];
  affectedTests: string[];
  affectedApis: string[];
  blastRadiusScore: number;
  evidence: string[];
  certainty: "KNOWN" | "INFERRED" | "UNKNOWN";
}

export function calculateImpact(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): ImpactAssessment | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const incoming = edges.filter((e) => e.to === nodeId);
  const outgoing = edges.filter((e) => e.from === nodeId);

  // Adjacency map for reverse lookup (who depends on X)
  const reverseAdj = new Map<string, string[]>();
  for (const e of edges) {
    const list = reverseAdj.get(e.to) || [];
    list.push(e.from);
    reverseAdj.set(e.to, list);
  }

  // BFS to find all transitive dependents
  const visited = new Set<string>();
  const queue = [...incoming.map((e) => e.from)];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === nodeId || visited.has(currentId)) continue;
    visited.add(currentId);

    const dependentsOfCurrent = reverseAdj.get(currentId) || [];
    for (const dep of dependentsOfCurrent) {
      if (!visited.has(dep)) {
        queue.push(dep);
      }
    }
  }

  const transitiveIds = Array.from(visited);

  // Identify affected tests
  const testPatterns = [/\.test\.(tsx?|jsx?|py|go)$/i, /\.spec\.(tsx?|jsx?)$/i, /tests?\//i, /__tests__\//i];
  const affectedTests = transitiveIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is GraphNode => Boolean(n?.filePath && testPatterns.some((p) => p.test(n.filePath!))))
    .map((n) => n.filePath!);

  // Identify affected APIs
  const apiPatterns = [/api\//i, /routes?\//i, /controllers?\//i, /endpoints?\//i];
  const affectedApis = transitiveIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is GraphNode => Boolean(n?.filePath && apiPatterns.some((p) => p.test(n.filePath!))))
    .map((n) => n.filePath!);

  // Calculate blast radius score (0-100)
  const totalNodesCount = Math.max(1, nodes.length);
  const affectedCount = transitiveIds.length + 1;
  const blastRadiusScore = Math.min(100, Math.round((affectedCount / totalNodesCount) * 100));

  const edgeEvidence = [...incoming, ...outgoing].flatMap((e) =>
    Array.isArray(e.evidence) ? e.evidence : e.evidence ? [e.evidence] : []
  );

  const certainty = incoming.length > 0 && edgeEvidence.length > 0 ? "KNOWN" : "INFERRED";

  return {
    node,
    directDependents: incoming,
    directDependencies: outgoing,
    transitiveDependentIds: transitiveIds,
    affectedTests: [...new Set(affectedTests)],
    affectedApis: [...new Set(affectedApis)],
    blastRadiusScore,
    evidence: [
      `Node ${node.label} (${node.id}) has ${incoming.length} direct dependents and ${outgoing.length} direct dependencies`,
      `Transitive blast radius affects ${transitiveIds.length} upstream nodes`,
      ...edgeEvidence,
    ],
    certainty,
  };
}
