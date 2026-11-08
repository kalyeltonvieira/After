import { authenticatedHeaders } from "../lib/api";
import { buildCommitMemoryEntries, sanitizeFirestoreData } from "../lib/firestoreSanitize";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "../lib/auth";
import {
  db,
  handleFirestoreError,
  OperationType,
} from "../lib/firebase";
import {
  Project,
  ProjectEvent,
  ProjectInsight,
  ProjectExperiment,
  GraphNode,
  GraphEdge,
  SoftwareMemoryEntry,
  AnalysisJob,
} from "../types";

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  events: ProjectEvent[];
  insights: ProjectInsight[];
  experiments: ProjectExperiment[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  memoryEntries: SoftwareMemoryEntry[];
  analysisJobs: AnalysisJob[];
  loadingProjects: boolean;
  createProject: (data: {
    name: string;
    description: string;
    repository: string;
    branch: string;
    framework: string;
    language: string;
  }) => Promise<Project>;
  connectRepository: (data: {
    repository: string;
    branch?: string;
  }) => Promise<Project>;
  updateCurrentProject: (data: Partial<Project>) => Promise<void>;
  deleteCurrentProject: () => Promise<void>;
  addEvent: (eventData: Omit<ProjectEvent, "id" | "projectId">) => Promise<void>;
  addInsight: (insightData: Omit<ProjectInsight, "id" | "projectId" | "createdAt">) => Promise<void>;
  addExperiment: (experimentData: Omit<ProjectExperiment, "id" | "projectId" | "createdAt" | "status">) => Promise<void>;
  updateExperimentStatus: (id: string, status: ProjectExperiment["status"]) => Promise<void>;
  selectedNodeForWhy: GraphNode | null;
  setSelectedNodeForWhy: (node: GraphNode | null) => void;
  isAskAfterOpen: boolean;
  setIsAskAfterOpen: (open: boolean) => void;
  aiContext: {
    type: "repository" | "file" | "node";
    label: string;
    path?: string;
    content?: string;
  } | null;
  setAiContext: (context: {
    type: "repository" | "file" | "node";
    label: string;
    path?: string;
    content?: string;
  } | null) => void;
  refreshAnalysis: () => Promise<void>;
  isAnalyzing: boolean;
  scanStage: ScanStage;
}

export type ScanStage =
  | "idle"
  | "repository"
  | "architecture"
  | "dependencies"
  | "history"
  | "insights"
  | "completed";

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [insights, setInsights] = useState<ProjectInsight[]>([]);
  const [experiments, setExperiments] = useState<ProjectExperiment[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [memoryEntries, setMemoryEntries] = useState<SoftwareMemoryEntry[]>([]);
  const [analysisJobs, setAnalysisJobs] = useState<AnalysisJob[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedNodeForWhy, setSelectedNodeForWhy] = useState<GraphNode | null>(null);
  const [isAskAfterOpen, setIsAskAfterOpen] = useState(false);
  const [aiContext, setAiContext] = useState<ProjectContextType["aiContext"]>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanStage, setScanStage] = useState<ScanStage>("idle");

  // 1. Subscribe to User's Projects in Firestore
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setCurrentProject(null);
      setEvents([]);
      setInsights([]);
      setExperiments([]);
      setGraphNodes([]);
      setGraphEdges([]);
      setMemoryEntries([]);
      setAnalysisJobs([]);
      setAiContext(null);
      setLoadingProjects(false);
      return;
    }

    const projectsQuery = query(
      collection(db, "projects"),
      where("ownerId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      projectsQuery,
      (snapshot) => {
        const list: Project[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Project);
        });

        // Sort by updatedAt descending
        list.sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt).getTime() -
            new Date(a.updatedAt || a.createdAt).getTime()
        );

        try {
          localStorage.setItem(`after.cached_projects.${user.uid}`, JSON.stringify(list));
        } catch {}

        setProjects(list);

        // Keep or select current project
        setCurrentProject((prev) => {
          if (!prev && list.length > 0) return list[0];
          if (prev && !list.find((p) => p.id === prev.id)) {
            return list.length > 0 ? list[0] : null;
          }
          if (prev) {
            const updated = list.find((p) => p.id === prev.id);
            return updated || null;
          }
          return null;
        });

        setLoadingProjects(false);
      },
      async (error) => {
        console.warn("Firestore live snapshot error, loading cached/API projects:", error?.message || error);
        try {
          const cached = localStorage.getItem(`after.cached_projects.${user.uid}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setProjects(parsed);
              setCurrentProject((prev) => prev || parsed[0]);
              setLoadingProjects(false);
              return;
            }
          }
        } catch {}

        try {
          const res = await fetch("/api/projects", { headers: await authenticatedHeaders() });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.projects) && data.projects.length > 0) {
              setProjects(data.projects);
              setCurrentProject((prev) => prev || data.projects[0]);
              setLoadingProjects(false);
              return;
            }
          }
        } catch {}

        setLoadingProjects(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 2. Hydrate analysis state from the project document itself.
  // This keeps repository connection functional even when named Firestore
  // subcollection rules have not yet been deployed in the environment.
  useEffect(() => {
    if (!user || !currentProject || currentProject.ownerId !== user.uid) {
      setEvents([]);
      setInsights([]);
      setExperiments([]);
      setMemoryEntries([]);
      setGraphNodes([]);
      setGraphEdges([]);
      return;
    }

    setEvents(currentProject.events || []);
    setInsights(currentProject.insights || []);
    setExperiments(currentProject.experiments || []);
    setMemoryEntries(currentProject.memoryEntries || []);
    setGraphNodes(currentProject.graphNodes || []);
    setGraphEdges(currentProject.graphEdges || []);
  }, [user, currentProject]);

  // 2.5. Poll persistent analysis jobs so UI reflects real backend state.
  useEffect(() => {
    if (!user || !currentProject || currentProject.ownerId !== user.uid) {
      setAnalysisJobs([]);
      return;
    }
    let cancelled = false;
    const loadJobs = async () => {
      try {
        const response = await fetch(`/api/projects/analysis-jobs/latest?projectId=${encodeURIComponent(currentProject.id)}`, {
          headers: await authenticatedHeaders(),
        });
        const body = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && Array.isArray(body.jobs)) setAnalysisJobs(body.jobs as AnalysisJob[]);
      } catch {
        if (!cancelled) setAnalysisJobs([]);
      }
    };
    void loadJobs();
    const timer = window.setInterval(() => void loadJobs(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user, currentProject?.id, currentProject?.ownerId]);

  // 3. Assemble graph nodes and edges strictly from real project definition & experiments
  useEffect(() => {
    if (!currentProject) {
      setGraphNodes([]);
      setGraphEdges([]);
      setMemoryEntries([]);
      setAiContext(null);
      return;
    }

    const rawNodes: GraphNode[] = [...(currentProject.graphNodes || [])];
    const rawEdges: GraphEdge[] = [...(currentProject.graphEdges || [])];

    // Deduplicate nodes by unique id
    const nodeMap = new Map<string, GraphNode>();
    for (const node of rawNodes) {
      if (node && node.id) {
        nodeMap.set(node.id, node);
      }
    }

    // Append dynamic experiment nodes if any exist
    experiments.forEach((exp) => {
      const expNodeId = `exp_${exp.id}`;
      if (!nodeMap.has(expNodeId)) {
        nodeMap.set(expNodeId, {
          id: expNodeId,
          label: exp.title,
          type: "experiment",
          category: "growth",
          status: exp.status === "running" ? "running" : "monitored",
          changesCount: 1,
          description: `Hypothesis: ${exp.hypothesis}`,
          lastModified: exp.createdAt,
        });
      }
    });

    // Deduplicate edges by from_to_label
    const edgeMap = new Map<string, GraphEdge>();
    for (const edge of rawEdges) {
      if (edge && edge.from && edge.to) {
        const edgeKey = `${edge.from}_${edge.to}_${edge.label || "link"}`;
        edgeMap.set(edgeKey, edge);
      }
    }

    setGraphNodes(Array.from(nodeMap.values()));
    setGraphEdges(Array.from(edgeMap.values()));
  }, [currentProject, experiments]);

  // Connect a Real Repository Flow
  const connectRepository = async ({
    repository,
    branch,
  }: {
    repository: string;
    branch?: string;
  }): Promise<Project> => {
    if (!user) throw new Error("Must be signed in to connect a repository");

    const normalizedRepository = repository.trim();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalizedRepository)) {
      throw new Error("Invalid repository. Use the format owner/repository.");
    }

    setIsAnalyzing(true);
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const projectRef = doc(db, "projects", projectId);

    try {
      // Persist a truthful pending state before starting network analysis.
      const pendingProject = {
        id: projectId,
        ownerId: user.uid,
        name: normalizedRepository.split("/").pop() || normalizedRepository,
        description: "Repository analysis in progress",
        repository: normalizedRepository,
        branch: branch?.trim() || "main",
        githubConnected: false,
        analysisStatus: "pending" as const,
        graphNodes: [],
        graphEdges: [],
        events: [],
        insights: [],
        memoryEntries: [],
        experiments: [],
        watchTargets: [],
        notifications: [],
        analysisJobs: [],
        createdAt: now,
        updatedAt: now,
      };
      // Persist provisional project record (non-blocking if Firestore rules/network are slow)
      try {
        await setDoc(projectRef, sanitizeFirestoreData(pendingProject));
      } catch (fsErr) {
        console.warn("Could not save provisional project to Firestore, proceeding with analysis:", fsErr);
      }

      const res = await fetch("/api/projects/analyze-repository", {
        method: "POST",
        credentials: "include",
        headers: await authenticatedHeaders({}, true),
        body: JSON.stringify({
          repository: normalizedRepository,
          ...(branch?.trim() ? { branch: branch.trim() } : {}),
          projectId,
        }),
      });

      const responseText = await res.text();
      let data: any;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          `Repository analysis returned an invalid response (${res.status}). Verify GitHub authorization and repository permissions.`
        );
      }
      if (!res.ok) {
        throw new Error(data?.error || `Failed to analyze repository (${res.status})`);
      }

      if (!data?.project || typeof data.project !== "object") {
        throw new Error("Repository analysis did not return valid project metadata.");
      }
      const repositoryName = String(data.project.repository || normalizedRepository).trim();
      const projectName = String(data.project.name || normalizedRepository.split("/").pop() || "").trim();
      const defaultBranch = String(data.project.defaultBranch || branch || "main").trim();
      const selectedBranch = String(data.project.branch || branch || defaultBranch).trim();
      if (!projectName || !repositoryName || !selectedBranch) {
        throw new Error("Repository analysis omitted required project identity or branch information.");
      }

      const rawEvents = Array.isArray(data.events) ? data.events : [];
      const nextEvents: ProjectEvent[] = rawEvents
        .filter((ev: any) => ev && typeof ev === "object" && typeof ev.id === "string" && typeof ev.event === "string")
        .map((ev: any) => ({
          ...ev,
          projectId,
          actor: typeof ev.actor === "string" ? ev.actor : "Unknown",
          timestamp: typeof ev.timestamp === "string" ? ev.timestamp : now,
          affectedComponents: Array.isArray(ev.affectedComponents) ? ev.affectedComponents.filter((v: unknown) => typeof v === "string") : [],
          reason: typeof ev.reason === "string" ? ev.reason : ev.event,
        }));

      const rawInsights = Array.isArray(data.insights) ? data.insights : [];
      const nextInsights: ProjectInsight[] = rawInsights
        .filter((ins: any) => ins && typeof ins === "object" && typeof ins.id === "string" && typeof ins.title === "string")
        .map((ins: any) => ({
          ...ins,
          projectId,
          description: typeof ins.description === "string" ? ins.description : "",
          evidence: typeof ins.evidence === "string" ? ins.evidence : "",
          affectedComponents: Array.isArray(ins.affectedComponents) ? ins.affectedComponents : [],
          createdAt: typeof ins.createdAt === "string" ? ins.createdAt : now,
        }));

      const nextMemoryEntries: SoftwareMemoryEntry[] = (Array.isArray(data.memoryEntries) ? data.memoryEntries : [])
        .filter((entry: any) => entry && typeof entry === "object")
        .map((entry: any, index: number) => {
          const source = entry.source && typeof entry.source === "object" ? entry.source : undefined;
          return {
            ...entry,
            id: typeof entry.id === "string" && entry.id ? entry.id : `memory_${index}`,
            projectId,
            type: ["commit", "pull_request", "issue", "release", "decision", "dependency", "insight"].includes(entry.type)
              ? entry.type
              : "insight",
            title: typeof entry.title === "string" ? entry.title : "Untitled observation",
            summary: typeof entry.summary === "string" ? entry.summary : "",
            status: entry.status === "INFERRED" || entry.status === "UNKNOWN" ? entry.status : "KNOWN",
            evidence: Array.isArray(entry.evidence) ? entry.evidence.filter((v: unknown) => typeof v === "string") : [],
            ...(source ? {
              source: {
                ...(typeof source.kind === "string" ? { kind: source.kind } : {}),
                ...(typeof source.id === "string" && source.id ? { id: source.id } : {}),
                ...(typeof source.url === "string" && source.url ? { url: source.url } : {}),
              },
            } : {}),
            createdAt: typeof entry.createdAt === "string" ? entry.createdAt : now,
            observedAt: typeof entry.observedAt === "string" ? entry.observedAt : now,
          } as SoftwareMemoryEntry;
        });

      // Only real commit events with a concrete SHA may create commit memories.
      nextMemoryEntries.push(
        ...buildCommitMemoryEntries(nextEvents, projectId, nextMemoryEntries, now)
      );

      for (const ins of nextInsights) {
        if (!ins.id || !ins.title) continue;
        const memoryId = `insight_${ins.id}`;
        if (nextMemoryEntries.some((entry) => entry.id === memoryId)) continue;
        nextMemoryEntries.push({
          id: memoryId,
          projectId,
          type: "insight",
          title: ins.title,
          summary: ins.description,
          status: "KNOWN",
          evidence: [ins.evidence, ...(ins.affectedFiles || [])].filter((value): value is string => typeof value === "string" && Boolean(value)),
          source: { kind: "after_analysis", id: ins.id },
          relatedFiles: ins.affectedFiles || [],
          relatedNodes: ins.affectedComponents || [],
          createdAt: ins.createdAt || now,
          observedAt: now,
        });
      }

      const dependencyNodes = (Array.isArray(data.graphNodes) ? data.graphNodes : [])
        .filter((node: any) => node && node.type === "dependency" && typeof node.id === "string" && typeof node.label === "string");
      for (const dependency of dependencyNodes) {
        const memoryId = `dependency_${dependency.id.replace(/[^A-Za-z0-9_-]/g, "")}`;
        if (nextMemoryEntries.some((entry) => entry.id === memoryId)) continue;
        nextMemoryEntries.push({
          id: memoryId,
          projectId,
          type: "dependency",
          title: dependency.label,
          summary: typeof dependency.description === "string"
            ? dependency.description
            : `Dependency declared in ${dependency.filePath || "repository metadata"}.`,
          status: "KNOWN",
          evidence: [typeof dependency.filePath === "string" ? dependency.filePath : "Repository dependency metadata"],
          source: {
            kind: "repository_dependency",
            id: typeof dependency.dependency === "string" ? dependency.dependency : dependency.id,
          },
          relatedFiles: typeof dependency.filePath === "string" ? [dependency.filePath] : [],
          relatedNodes: [dependency.id],
          createdAt: now,
          observedAt: now,
        });
      }

      const graphNodes = Array.isArray(data.graphNodes) ? data.graphNodes : [];
      const graphEdges = Array.isArray(data.graphEdges) ? data.graphEdges : [];
      const newProject: Project = {
        id: projectId,
        ownerId: user.uid,
        name: projectName,
        description: typeof data.project.description === "string" ? data.project.description : "",
        repository: repositoryName,
        branch: selectedBranch,
        defaultBranch,
        framework: typeof data.project.framework === "string" ? data.project.framework : "Unknown",
        language: typeof data.project.language === "string" ? data.project.language : "Unknown",
        ...(Number.isFinite(data.project.stars) ? { stars: Number(data.project.stars) } : {}),
        ...(Number.isFinite(data.project.openIssues) ? { openIssues: Number(data.project.openIssues) } : {}),
        githubConnected: true,
        telemetryConnected: false,
        webhookConfigured: Boolean(data.project.webhookConfigured),
        watchTargets: [],
        notifications: [],
        analysisJobs: [],
        graphNodes,
        graphEdges,
        events: nextEvents,
        insights: nextInsights,
        experiments: [],
        memoryEntries: nextMemoryEntries,
        analysisStatus: "completed",
        createdAt: now,
        updatedAt: now,
      };

      // Firestore receives a sanitized object; optional fields are omitted
      try {
        await setDoc(projectRef, sanitizeFirestoreData(newProject));
      } catch (fsErr) {
        console.warn("Could not save completed project to Firestore, using local cache:", fsErr);
      }

      // Persist in localStorage so project survives reload
      try {
        const cachedStr = localStorage.getItem(`after.cached_projects.${user.uid}`);
        const cached = cachedStr ? JSON.parse(cachedStr) : [];
        const existingIdx = cached.findIndex((p: Project) => p.id === newProject.id);
        if (existingIdx >= 0) {
          cached[existingIdx] = newProject;
        } else {
          cached.unshift(newProject);
        }
        localStorage.setItem(`after.cached_projects.${user.uid}`, JSON.stringify(cached));
      } catch {}

      setProjects((prev) => [newProject, ...prev.filter((p) => p.id !== newProject.id)]);
      setEvents(nextEvents);
      setInsights(nextInsights);
      setExperiments([]);
      setMemoryEntries(nextMemoryEntries);
      setCurrentProject(newProject);
      setLoadingProjects(false);
      return newProject;
    } catch (err: any) {
      console.error("Connect repository error:", err);
      // Keep a diagnosable failed state rather than leaving a project stuck as pending.
      try {
        await updateDoc(projectRef, sanitizeFirestoreData({
          githubConnected: false,
          analysisStatus: "failed",
          analysisError: err?.message || "Repository connection failed.",
          updatedAt: new Date().toISOString(),
        }));
      } catch {
        // The provisional document may not have been created
      }
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Create clean project manually (or connect if repo provided)
  const createProject = async ({
    name,
    description,
    repository,
    branch,
    framework,
    language,
  }: {
    name: string;
    description: string;
    repository: string;
    branch: string;
    framework: string;
    language: string;
  }): Promise<Project> => {
    if (!user) throw new Error("Must be signed in to create a project");

    // A repository identifier is an explicit request for a real connection.
    // Never silently downgrade a failed analysis into a fake/empty connected project.
    if (repository && repository.includes("/")) {
      return await connectRepository({ repository, branch });
    }

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newProject: Project = {
      id: projectId,
      ownerId: user.uid,
      name: name.trim(),
      description: description.trim(),
      repository: repository.trim() || "unconnected",
      branch: branch.trim() || "unselected",
      framework: framework.trim() || "Standard",
      language: language.trim() || "TypeScript",
      createdAt: now,
      updatedAt: now,
      githubConnected: false,
      telemetryConnected: false,
      graphNodes: [],
      graphEdges: [],
    };

    try {
      try {
        await setDoc(doc(db, "projects", projectId), sanitizeFirestoreData(newProject));
      } catch (fsErr) {
        console.warn("Could not write project to Firestore, caching locally:", fsErr);
      }

      try {
        const cachedStr = localStorage.getItem(`after.cached_projects.${user.uid}`);
        const cached = cachedStr ? JSON.parse(cachedStr) : [];
        cached.unshift(newProject);
        localStorage.setItem(`after.cached_projects.${user.uid}`, JSON.stringify(cached));
      } catch {}

      setProjects((prev) => [newProject, ...prev.filter((p) => p.id !== newProject.id)]);
      setCurrentProject(newProject);
      return newProject;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${projectId}`);
    }
  };

  // Update current project
  const updateCurrentProject = async (data: Partial<Project>) => {
    if (!user || !currentProject) return;
    const now = new Date().toISOString();
    const updated = { ...data, updatedAt: now };

    try {
      try {
        await updateDoc(doc(db, "projects", currentProject.id), sanitizeFirestoreData(updated));
      } catch (fsErr) {
        console.warn("Could not update project in Firestore, updating locally:", fsErr);
      }

      setCurrentProject((prev) => (prev ? { ...prev, ...updated } : null));
      setProjects((prev) => prev.map((p) => (p.id === currentProject.id ? { ...p, ...updated } : p)));

      try {
        const cachedStr = localStorage.getItem(`after.cached_projects.${user.uid}`);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          const idx = cached.findIndex((p: Project) => p.id === currentProject.id);
          if (idx >= 0) {
            cached[idx] = { ...cached[idx], ...updated };
            localStorage.setItem(`after.cached_projects.${user.uid}`, JSON.stringify(cached));
          }
        }
      } catch {}
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${currentProject.id}`);
    }
  };

  // Delete current project
  const deleteCurrentProject = async () => {
    if (!user || !currentProject) return;
    const projectId = currentProject.id;
    try {
      try {
        await deleteDoc(doc(db, "projects", projectId));
      } catch (fsErr) {
        console.warn("Could not delete project in Firestore, deleting locally:", fsErr);
      }

      setCurrentProject(null);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));

      try {
        const cachedStr = localStorage.getItem(`after.cached_projects.${user.uid}`);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr).filter((p: Project) => p.id !== projectId);
          localStorage.setItem(`after.cached_projects.${user.uid}`, JSON.stringify(cached));
        }
      } catch {}
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
    }
  };

  // Add event
  const addEvent = async (eventData: Omit<ProjectEvent, "id" | "projectId">) => {
    if (!currentProject || !user) return;
    const evId = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullEvent: ProjectEvent = {
      ...eventData,
      id: evId,
      projectId: currentProject.id,
      ownerId: user.uid,
    } as any;
    const nextEvents = [fullEvent, ...(currentProject.events || [])];
    try {
      await updateDoc(doc(db, "projects", currentProject.id), sanitizeFirestoreData({
        events: nextEvents,
        updatedAt: new Date().toISOString(),
      }));
    } catch (fsErr) {
      console.warn("Could not save event to Firestore:", fsErr);
    }
    const updatedEvents = { ...currentProject, events: nextEvents, updatedAt: new Date().toISOString() };
    setCurrentProject(updatedEvents);
    setEvents(nextEvents);
  };

  // Add insight
  const addInsight = async (
    insightData: Omit<ProjectInsight, "id" | "projectId" | "createdAt">
  ) => {
    if (!currentProject || !user) return;
    const insId = `ins_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullInsight: ProjectInsight = {
      ...insightData,
      id: insId,
      projectId: currentProject.id,
      createdAt: new Date().toISOString(),
      ownerId: user.uid,
    } as any;
    const nextInsights = [fullInsight, ...(currentProject.insights || [])];
    try {
      await updateDoc(doc(db, "projects", currentProject.id), sanitizeFirestoreData({
        insights: nextInsights,
        updatedAt: new Date().toISOString(),
      }));
    } catch (fsErr) {
      console.warn("Could not save insight to Firestore:", fsErr);
    }
    const updatedInsights = { ...currentProject, insights: nextInsights, updatedAt: new Date().toISOString() };
    setCurrentProject(updatedInsights);
    setInsights(nextInsights);
  };

  // Add experiment
  const addExperiment = async (
    experimentData: Omit<ProjectExperiment, "id" | "projectId" | "createdAt" | "status">
  ) => {
    if (!currentProject || !user) return;
    const expId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullExp: ProjectExperiment = {
      ...experimentData,
      id: expId,
      projectId: currentProject.id,
      status: "draft",
      createdAt: new Date().toISOString(),
      ownerId: user.uid,
    } as any;
    const nextExperiments = [fullExp, ...(currentProject.experiments || [])];
    try {
      await updateDoc(doc(db, "projects", currentProject.id), sanitizeFirestoreData({
        experiments: nextExperiments,
        updatedAt: new Date().toISOString(),
      }));
    } catch (fsErr) {
      console.warn("Could not save experiment to Firestore:", fsErr);
    }
    const updatedExp = { ...currentProject, experiments: nextExperiments, updatedAt: new Date().toISOString() };
    setCurrentProject(updatedExp);
    setExperiments(nextExperiments);
  };

  // Update experiment status
  const updateExperimentStatus = async (id: string, status: ProjectExperiment["status"]) => {
    if (!currentProject || !user) return;
    const nextExperiments = (currentProject.experiments || []).map((experiment) =>
      experiment.id === id ? { ...experiment, status, updatedAt: new Date().toISOString() } : experiment
    );
    try {
      await updateDoc(doc(db, "projects", currentProject.id), sanitizeFirestoreData({
        experiments: nextExperiments,
        updatedAt: new Date().toISOString(),
      }));
    } catch (fsErr) {
      console.warn("Could not update experiment status in Firestore:", fsErr);
    }
    const updatedExp = { ...currentProject, experiments: nextExperiments, updatedAt: new Date().toISOString() };
    setCurrentProject(updatedExp);
    setExperiments(nextExperiments);
  };

  // Re-run repository analysis & forensic AI scan
  const refreshAnalysis = async () => {
    if (!currentProject || !user) return;
    setIsAnalyzing(true);
    setScanStage("repository");

    try {
      if (currentProject.repository && currentProject.repository.includes("/")) {
        const res = await fetch("/api/projects/analyze-repository", {
          method: "POST",
          credentials: "include",
          headers: await authenticatedHeaders({}, true),
          body: JSON.stringify({
            repository: currentProject.repository,
            branch: currentProject.branch,
          }),
        });

        const text = await res.text();
        let data: any;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(
            `Repository analysis returned non-JSON response (${res.status}).`
          );
        }

        if (!res.ok) {
          throw new Error(
            data?.error || `Repository analysis failed (${res.status}).`
          );
        }
        setScanStage("architecture");

        if (data.graphNodes && data.graphNodes.length > 0) {
          await updateCurrentProject({
            graphNodes: data.graphNodes,
            graphEdges: data.graphEdges || [],
            framework: data.project.framework,
            language: data.project.language,
            stars: data.project.stars,
            openIssues: data.project.openIssues,
          });
          setGraphNodes(data.graphNodes);
          setGraphEdges(data.graphEdges || []);
        }

        for (const ins of data.insights || []) {
          await addInsight(ins);
        }
      }

      setScanStage("insights");
      const aiRes = await fetch("/api/gemini/analyze-insights", {
        method: "POST",
        headers: await authenticatedHeaders(),
        body: JSON.stringify({
          projectId: currentProject.id,
        }),
      });

      if (!aiRes.ok) {
        const errorBody = await aiRes.json().catch(() => ({}));
        throw new Error(
          errorBody.error || `Insight analysis failed (${aiRes.status}).`
        );
      }

      const aiData = await aiRes.json();
      for (const ins of aiData.insights || []) {
        await addInsight(ins);
      }

      setScanStage("completed");
      setTimeout(() => setScanStage("idle"), 1000);
    } catch (error) {
      console.error("Failed to refresh analysis:", error);
      setScanStage("idle");
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        setCurrentProject,
        events,
        insights,
        experiments,
        graphNodes,
        graphEdges,
        memoryEntries,
        analysisJobs,
        loadingProjects,
        createProject,
        connectRepository,
        updateCurrentProject,
        deleteCurrentProject,
        addEvent,
        addInsight,
        addExperiment,
        updateExperimentStatus,
        selectedNodeForWhy,
        setSelectedNodeForWhy,
        isAskAfterOpen,
        setIsAskAfterOpen,
        aiContext,
        setAiContext,
        refreshAnalysis,
        isAnalyzing,
        scanStage,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return context;
}
