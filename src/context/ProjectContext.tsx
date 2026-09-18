import { authenticatedHeaders } from "../lib/api";
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
import { useAuth } from "./AuthContext";
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
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, "projects");
        } catch (e) {
          // Handled
        }
        setProjects([]);
        setCurrentProject(null);
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

    const nodes: GraphNode[] = [...(currentProject.graphNodes || [])];
    const edges: GraphEdge[] = [...(currentProject.graphEdges || [])];

    // Append dynamic experiment nodes if any exist
    experiments.forEach((exp) => {
      const expNodeId = `exp_${exp.id}`;
      if (!nodes.some((n) => n.id === expNodeId)) {
        nodes.push({
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

    setGraphNodes(nodes);
    setGraphEdges(edges);
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

    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/projects/analyze-repository", {
        method: "POST",
        headers: await authenticatedHeaders({}, true),
        body: JSON.stringify({ repository, branch }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to analyze repository");
      }

      const data = await res.json();
      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      const nextEvents: ProjectEvent[] = (data.events || []).map((ev: ProjectEvent) => ({
        ...ev,
        projectId,
      }));
      const nextInsights: ProjectInsight[] = (data.insights || []).map((ins: ProjectInsight) => ({
        ...ins,
        projectId,
        createdAt: ins.createdAt || now,
      }));
      const nextMemoryEntries: SoftwareMemoryEntry[] = (Array.isArray(data.memoryEntries) ? data.memoryEntries : [])
        .map((entry: any, index: number) => ({
          ...entry,
          id: entry.id || `memory_${index}`,
          projectId,
          status: entry.status === "INFERRED" || entry.status === "UNKNOWN" ? entry.status : "KNOWN",
          evidence: Array.isArray(entry.evidence) ? entry.evidence : [],
          createdAt: entry.createdAt || now,
          observedAt: entry.observedAt || now,
        }));

      for (const ev of nextEvents) {
        const sourceId = String(ev.metadata?.fullSha || ev.metadata?.sha || ev.id);
        const alreadyRecorded = nextMemoryEntries.some(
          (entry) => String(entry.source?.id || "") === sourceId
        );
        if (alreadyRecorded) continue;
        const memoryId = `commit_${sourceId.replace(/[^A-Za-z0-9_-]/g, "")}`;
        nextMemoryEntries.push({
          id: memoryId,
          projectId,
          type: "commit",
          title: ev.event,
          summary: ev.reason || ev.event,
          status: "KNOWN",
          evidence: [
            ev.metadata?.fullSha ? `Commit ${ev.metadata.fullSha}` : `Recorded commit event ${ev.id}`,
            ...(Array.isArray(ev.affectedComponents) ? ev.affectedComponents.slice(0, 10) : []),
          ],
          source: {
            kind: "github_commit",
            id: ev.metadata?.fullSha || ev.metadata?.sha,
            url: ev.metadata?.url,
          },
          relatedFiles: Array.isArray(ev.affectedComponents) ? ev.affectedComponents : [],
          createdAt: ev.timestamp || now,
          observedAt: now,
        });
      }

      for (const ins of nextInsights) {
        nextMemoryEntries.push({
          id: `insight_${ins.id}`,
          projectId,
          type: "insight",
          title: ins.title,
          summary: ins.description,
          status: "KNOWN",
          evidence: [ins.evidence, ...(ins.affectedFiles || [])].filter(Boolean),
          source: { kind: "after_analysis", id: ins.id },
          relatedFiles: ins.affectedFiles || [],
          relatedNodes: ins.affectedComponents || [],
          createdAt: ins.createdAt || now,
          observedAt: now,
        });
      }

      for (const dependency of (data.graphNodes || []).filter((node: any) => node.type === "dependency")) {
        nextMemoryEntries.push({
          id: `dependency_${String(dependency.id).replace(/[^A-Za-z0-9_-]/g, "")}`,
          projectId,
          type: "dependency",
          title: dependency.label,
          summary: dependency.description || `Dependency declared in ${dependency.filePath || "repository metadata"}.`,
          status: "KNOWN",
          evidence: [dependency.filePath || "repository dependency metadata"],
          source: { kind: "repository_dependency", id: dependency.dependency || dependency.id },
          relatedFiles: dependency.filePath ? [dependency.filePath] : [],
          relatedNodes: [dependency.id],
          createdAt: now,
          observedAt: now,
        });
      }

      const newProject: Project = {
        id: projectId,
        ownerId: user.uid,
        name: data.project.name,
        description: data.project.description,
        repository: data.project.repository,
        branch: data.project.branch,
        defaultBranch: data.project.defaultBranch,
        framework: data.project.framework,
        language: data.project.language,
        stars: data.project.stars,
        openIssues: data.project.openIssues,
        githubConnected: true,
        telemetryConnected: false,
        graphNodes: data.graphNodes || [],
        graphEdges: data.graphEdges || [],
        events: nextEvents,
        insights: nextInsights,
        experiments: [],
        memoryEntries: nextMemoryEntries,
        createdAt: now,
        updatedAt: now,
      };

      // 1. Save project document in Firestore
      await setDoc(doc(db, "projects", projectId), newProject);
      setEvents(nextEvents);
      setInsights(nextInsights);
      setExperiments([]);
      setMemoryEntries(nextMemoryEntries);

      setCurrentProject(newProject);
      return newProject;
    } catch (err: any) {
      console.error("Connect repository error:", err);
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
      await setDoc(doc(db, "projects", projectId), newProject);
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
      await updateDoc(doc(db, "projects", currentProject.id), updated);
      setCurrentProject((prev) => (prev ? { ...prev, ...updated } : null));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${currentProject.id}`);
    }
  };

  // Delete current project
  const deleteCurrentProject = async () => {
    if (!user || !currentProject) return;
    const projectId = currentProject.id;
    try {
      await deleteDoc(doc(db, "projects", projectId));
      setCurrentProject(null);
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
    await updateDoc(doc(db, "projects", currentProject.id), {
      events: nextEvents,
      updatedAt: new Date().toISOString(),
    });
    setCurrentProject({ ...currentProject, events: nextEvents, updatedAt: new Date().toISOString() });
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
    await updateDoc(doc(db, "projects", currentProject.id), {
      insights: nextInsights,
      updatedAt: new Date().toISOString(),
    });
    setCurrentProject({ ...currentProject, insights: nextInsights, updatedAt: new Date().toISOString() });
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
    await updateDoc(doc(db, "projects", currentProject.id), {
      experiments: nextExperiments,
      updatedAt: new Date().toISOString(),
    });
    setCurrentProject({ ...currentProject, experiments: nextExperiments, updatedAt: new Date().toISOString() });
    setExperiments(nextExperiments);
  };

  // Update experiment status
  const updateExperimentStatus = async (id: string, status: ProjectExperiment["status"]) => {
    if (!currentProject || !user) return;
    const nextExperiments = (currentProject.experiments || []).map((experiment) =>
      experiment.id === id ? { ...experiment, status, updatedAt: new Date().toISOString() } : experiment
    );
    await updateDoc(doc(db, "projects", currentProject.id), {
      experiments: nextExperiments,
      updatedAt: new Date().toISOString(),
    });
    setCurrentProject({ ...currentProject, experiments: nextExperiments, updatedAt: new Date().toISOString() });
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
          headers: await authenticatedHeaders({}, true),
          body: JSON.stringify({
            repository: currentProject.repository,
            branch: currentProject.branch,
          }),
        });

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}));
          throw new Error(
            errorBody.error || `Repository analysis failed (${res.status}).`
          );
        }

        const data = await res.json();
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