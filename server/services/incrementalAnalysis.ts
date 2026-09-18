import crypto from "node:crypto";
import { getAdminFirestore } from "../auth.js";
import { getPersistentGitHubToken } from "../githubSession.js";
import { parseGitHubRepo } from "./githubService.js";

type IncrementalInput = {
  projectId: string;
  ownerId: string;
  branch: string;
  changedFiles: string[];
  removedFiles?: string[];
  commitSha?: string;
  deliveryId?: string;
};

const sourceExtensions = /\.(tsx?|jsx?|vue|py|go|rs)$/i;
const ignoredPath = /(^|\/)(node_modules|vendor|dist|build|coverage|\.git|\.cache|venv|__pycache__)(\/|$)/;
const projectQueues = new Map<string, Promise<void>>();

const symbolPatterns: Array<{ regex: RegExp; type: "function" | "class" }> = [
  { regex: /(?:export\s+default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g, type: "function" },
  { regex: /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g, type: "class" },
  { regex: /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g, type: "function" },
  { regex: /\bdef\s+([A-Za-z_][\w]*)\s*\(/g, type: "function" },
  { regex: /\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_][\w]*)\s*\(/g, type: "function" },
  { regex: /\bfn\s+([A-Za-z_][\w]*)\s*\(/g, type: "function" },
];

function headers(token?: string) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "AFTER-Continuous-Observation",
    ...(token ? { Authorization: `Bearer ${token.trim()}` } : {}),
  };
}

async function githubGet(url: string, token?: string) {
  const response = await fetch(url, { headers: headers(token) });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

async function setJob(projectId: string, jobId: string, patch: Record<string, any>) {
  const db = getAdminFirestore();
  await db.collection("projects").doc(projectId).collection("analysisJobs").doc(jobId).set({
    id: jobId,
    projectId,
    updatedAt: new Date().toISOString(),
    ...patch,
  }, { merge: true });
}

function makeFileNode(path: string) {
  const safe = path.replace(/[^a-zA-Z0-9_]/g, "_");
  const label = path.split("/").pop() || path;
  return {
    id: `file_${safe}`,
    label,
    type: "file",
    category: "source",
    status: "updated",
    changesCount: 1,
    filePath: path,
    symbol: label.replace(/\.[^/.]+$/, ""),
    line: 1,
    description: "Source file observed from the repository tree.",
  };
}

function resolveRelative(fromPath: string, specifier: string, nodesByPath: Map<string, any>) {
  if (!specifier.startsWith(".")) return null;
  const base = fromPath.split("/").slice(0, -1).join("/");
  const raw = `${base}/${specifier}`.replace(/\/\.\//g, "/").replace(/\/\/+/g, "/");
  const candidates = [
    raw, `${raw}.ts`, `${raw}.tsx`, `${raw}.js`, `${raw}.jsx`, `${raw}.vue`,
    `${raw}.py`, `${raw}.go`, `${raw}.rs`,
    `${raw}/index.ts`, `${raw}/index.tsx`, `${raw}/index.js`, `${raw}/index.py`,
  ];
  return candidates.find((candidate) => nodesByPath.has(candidate)) || null;
}

function extractImports(content: string) {
  const imports = new Set<string>();
  const patterns = [
    /(?:import\s+(?:[^;]*?\s+from\s+)?|export\s+[^;]*?\s+from\s+|require\s*\(\s*|from\s+)[\"']([^\"']+)[\"']/g,
    /(?:^|\n)\s*(?:from\s+|import\s+)[\"']([^\"']+)[\"']/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) imports.add(match[1]);
    }
  }
  return imports;
}

function extractSymbols(path: string, content: string, parent: any) {
  const nodes: any[] = [];
  const ids = new Set<string>();
  for (const pattern of symbolPatterns) {
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(content)) && ids.size < 24) {
      const symbol = match[1];
      if (!symbol || ids.has(symbol)) continue;
      ids.add(symbol);
      const line = content.slice(0, match.index).split("\n").length;
      const symbolId = `symbol_${path.replace(/[^a-zA-Z0-9_]/g, "_")}_${symbol.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      nodes.push({
        id: symbolId,
        label: symbol,
        type: pattern.type,
        category: parent.category || "source",
        status: "updated",
        changesCount: 1,
        filePath: path,
        symbol,
        line,
        parentId: parent.id,
        description: `Symbol ${symbol} observed in ${path}.`,
      });
    }
  }
  return nodes;
}

export async function enqueueIncrementalAnalysis(input: IncrementalInput) {
  const db = getAdminFirestore();
  const identity = input.commitSha || input.deliveryId || crypto.randomUUID();
  const jobId = `incremental_${crypto.createHash("sha256").update(`${input.projectId}:${identity}`).digest("hex").slice(0, 24)}`;
  const jobRef = db.collection("projects").doc(input.projectId).collection("analysisJobs").doc(jobId);
  const existing = await jobRef.get();
  if (existing.exists && ["queued", "fetching", "analyzing", "building_graph"].includes(String(existing.data()?.status))) {
    return { jobId, queued: false };
  }

  await jobRef.set({
    id: jobId,
    projectId: input.projectId,
    ownerId: input.ownerId,
    mode: "incremental",
    status: "queued",
    branch: input.branch,
    commitSha: input.commitSha || null,
    changedFiles: [...new Set(input.changedFiles)],
    removedFiles: [...new Set(input.removedFiles || [])],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  const previous = projectQueues.get(input.projectId) || Promise.resolve();
  const task = previous
    .catch(() => undefined)
    .then(() => runIncrementalAnalysis({ ...input, jobId }))
    .catch((error) => {
      console.warn("Incremental analysis worker failed:", error?.message);
    });
  projectQueues.set(input.projectId, task);
  void task.finally(() => {
    if (projectQueues.get(input.projectId) === task) projectQueues.delete(input.projectId);
  });

  return { jobId, queued: true };
}

async function runIncrementalAnalysis(input: IncrementalInput & { jobId: string }) {
  const db = getAdminFirestore();
  const projectRef = db.collection("projects").doc(input.projectId);
  try {
    await setJob(input.projectId, input.jobId, { status: "fetching", startedAt: new Date().toISOString(), error: null });

    const projectSnap = await projectRef.get();
    if (!projectSnap.exists || projectSnap.data()?.ownerId !== input.ownerId) throw new Error("Project no longer exists or is not owned by the event owner.");
    const project = projectSnap.data() || {};
    const parsed = parseGitHubRepo(String(project.repository || ""));
    if (!parsed) throw new Error("Project repository is not a valid GitHub repository.");

    const token = await getPersistentGitHubToken(input.ownerId);
    const ref = input.branch || project.branch || project.defaultBranch;
    const nodes = Array.isArray(project.graphNodes) ? [...project.graphNodes] : [];
    const edges = Array.isArray(project.graphEdges) ? [...project.graphEdges] : [];
    const files = [...new Set(input.changedFiles.filter((value) => value && !ignoredPath.test(value)))];
    const removed = new Set((input.removedFiles || []).filter(Boolean));
    const changed = new Set(files);

    const nodeForPath = (path: string) => nodes.find((node: any) => node.filePath === path && !node.parentId);
    const removePath = (path: string) => {
      const parent = nodeForPath(path);
      if (!parent) return;
      const removedIds = new Set([parent.id, ...nodes.filter((node: any) => node.parentId === parent.id).map((node: any) => node.id)]);
      for (let i = nodes.length - 1; i >= 0; i -= 1) if (removedIds.has(nodes[i].id)) nodes.splice(i, 1);
      for (let i = edges.length - 1; i >= 0; i -= 1) if (removedIds.has(edges[i].from) || removedIds.has(edges[i].to) || (edges[i].from === parent.id && edges[i].label === "imports")) edges.splice(i, 1);
    };

    for (const path of removed) removePath(path);

    const sourceContents = new Map<string, string>();
    for (const path of files) {
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
      const result = await githubGet(url, token || undefined);
      const existingNode = nodeForPath(path);

      if (result.response.status === 404) {
        removePath(path);
        continue;
      }
      if (!result.response.ok) throw new Error(`GitHub content lookup failed for ${path} (${result.response.status}).`);

      const body = result.body || {};
      let parent = existingNode;
      if (!parent) {
        parent = makeFileNode(path);
        nodes.push(parent);
      } else {
        parent.changesCount = Number(parent.changesCount || 0) + 1;
        parent.status = "updated";
      }

      for (let i = nodes.length - 1; i >= 0; i -= 1) {
        if (nodes[i].parentId === parent.id) nodes.splice(i, 1);
      }
      for (let i = edges.length - 1; i >= 0; i -= 1) {
        if ((edges[i].from === parent.id || edges[i].to === parent.id) && edges[i].label === "imports") edges.splice(i, 1);
      }

      if (sourceExtensions.test(path) && body.encoding === "base64" && typeof body.content === "string") {
        const source = Buffer.from(body.content.replace(/\n/g, ""), "base64").toString("utf8");
        if (source.length <= 250_000) {
          sourceContents.set(path, source);
          const symbols = extractSymbols(path, source, parent);
          nodes.push(...symbols);
          for (const symbol of symbols) {
            edges.push({
              from: parent.id,
              to: symbol.id,
              label: "contains",
              evidence: `${path} contains symbol ${symbol.symbol} at line ${symbol.line}.`,
            });
          }
        }
      }
    }

    await setJob(input.projectId, input.jobId, { status: "analyzing", updatedAt: new Date().toISOString() });

    const nodesByPath = new Map<string, any>();
    for (const node of nodes) if (node.filePath && !node.parentId) nodesByPath.set(node.filePath, node);
    const dependencyByName = new Map(nodes.filter((node: any) => node.type === "dependency").map((node: any) => [node.dependency, node]));

    for (const [path, source] of sourceContents) {
      const from = nodesByPath.get(path);
      if (!from) continue;
      for (const specifier of extractImports(source)) {
        const targetPath = resolveRelative(path, specifier, nodesByPath);
        if (targetPath) {
          const target = nodesByPath.get(targetPath);
          if (target) edges.push({ from: from.id, to: target.id, label: "imports", evidence: `${path} imports ${specifier}` });
          continue;
        }
        const dependencyName = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
        const dependency = dependencyByName.get(dependencyName);
        if (dependency) edges.push({ from: from.id, to: dependency.id, label: "imports", evidence: `${path} imports ${specifier}` });
      }
    }

    const seenEdges = new Set<string>();
    const normalizedEdges = edges.filter((edge: any) => {
      const key = `${edge.from}:${edge.to}:${edge.label || ""}`;
      if (seenEdges.has(key)) return false;
      seenEdges.add(key);
      return Boolean(nodes.some((node: any) => node.id === edge.from) && nodes.some((node: any) => node.id === edge.to));
    });

    await setJob(input.projectId, input.jobId, { status: "building_graph", updatedAt: new Date().toISOString() });
    const now = new Date().toISOString();
    const update = {
      graphNodes: nodes,
      graphEdges: normalizedEdges,
      updatedAt: now,
    };
    await projectRef.set(update, { merge: true });
    const memoryEntry = {
      id: `analysis_${input.jobId}`,
      projectId: input.projectId,
      ownerId: input.ownerId,
      type: "commit",
      title: input.commitSha ? `Incremental analysis for ${input.commitSha.slice(0, 8)}` : "Incremental repository analysis",
      summary: `AFTER reprocessed ${changed.size} changed file(s) from the observed repository event.`,
      status: "KNOWN",
      evidence: [
        `Branch: ${ref}`,
        ...(input.commitSha ? [`Commit: ${input.commitSha}`] : []),
        ...[...changed].slice(0, 20),
      ],
      source: { kind: "incremental_analysis", id: input.commitSha || input.jobId },
      relatedFiles: [...changed].slice(0, 50),
      createdAt: now,
      observedAt: now,
    };
    const existingMemory = Array.isArray(project.memoryEntries) ? project.memoryEntries : [];
    await projectRef.set({
      graphNodes: nodes,
      graphEdges: normalizedEdges,
      memoryEntries: [memoryEntry, ...existingMemory.filter((entry: any) => entry.id !== memoryEntry.id)].slice(0, 200),
      updatedAt: now,
    }, { merge: true });

    await setJob(input.projectId, input.jobId, {
      status: "completed",
      completedAt: now,
      updatedAt: now,
      summary: `Reprocessed ${changed.size} changed file(s) and updated the persisted Product Graph.`,
    });
  } catch (error: any) {
    await setJob(input.projectId, input.jobId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: error?.message || "Incremental analysis failed.",
    });
    throw error;
  }
}


export async function recoverQueuedIncrementalAnalyses() {
  const db = getAdminFirestore();
  let snapshot;
  try {
    snapshot = await db.collectionGroup("analysisJobs")
      .where("status", "==", "queued")
      .limit(100)
      .get();
  } catch (error: any) {
    console.warn("Skipping queued analysis recovery because Firestore is unavailable:", error?.message || error);
    return 0;
  }

  for (const job of snapshot.docs) {
    const data = job.data();
    if (data.mode !== "incremental" || !data.projectId || !data.ownerId) continue;
    const input: IncrementalInput & { jobId: string } = {
      jobId: job.id,
      projectId: String(data.projectId),
      ownerId: String(data.ownerId),
      branch: String(data.branch || ""),
      changedFiles: Array.isArray(data.changedFiles) ? data.changedFiles.filter((v: any) => typeof v === "string") : [],
      removedFiles: Array.isArray(data.removedFiles) ? data.removedFiles.filter((v: any) => typeof v === "string") : [],
      commitSha: typeof data.commitSha === "string" && data.commitSha ? data.commitSha : undefined,
      deliveryId: job.id,
    };
    const previous = projectQueues.get(input.projectId) || Promise.resolve();
    const task = previous
      .catch(() => undefined)
      .then(() => runIncrementalAnalysis(input))
      .catch((error) => console.warn("Recovered incremental analysis failed:", error?.message));
    projectQueues.set(input.projectId, task);
    void task.finally(() => {
      if (projectQueues.get(input.projectId) === task) projectQueues.delete(input.projectId);
    });
  }

  return snapshot.size;
}
