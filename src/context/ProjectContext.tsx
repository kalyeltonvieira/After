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
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedNodeForWhy, setSelectedNodeForWhy] = useState<GraphNode | null>(null);
  const [isAskAfterOpen, setIsAskAfterOpen] = useState(false);
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

  // 2. Subscribe to subcollections of current project: events, insights, experiments
  useEffect(() => {
    if (!user || !currentProject || currentProject.ownerId !== user.uid) {
      setEvents([]);
      setInsights([]);
      setExperiments([]);
      setGraphNodes([]);
      setGraphEdges([]);
      return;
    }

    const projectId = currentProject.id;

    // A. Events
    const eventsRef = collection(db, "projects", projectId, "events");
    const unsubEvents = onSnapshot(
      eventsRef,
      (snapshot) => {
        const evList: ProjectEvent[] = [];
        snapshot.forEach((d) => evList.push(d.data() as ProjectEvent));
        setEvents(evList);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/events`);
        } catch (e) {
          // Handled
        }
        setEvents([]);
      }
    );

    // B. Insights
    const insightsRef = collection(db, "projects", projectId, "insights");
    const unsubInsights = onSnapshot(
      insightsRef,
      (snapshot) => {
        const insList: ProjectInsight[] = [];
        snapshot.forEach((d) => insList.push(d.data() as ProjectInsight));
        setInsights(insList);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/insights`);
        } catch (e) {
          // Handled
        }
        setInsights([]);
      }
    );

    // C. Experiments
    const experimentsRef = collection(db, "projects", projectId, "experiments");
    const unsubExp = onSnapshot(
      experimentsRef,
      (snapshot) => {
        const expList: ProjectExperiment[] = [];
        snapshot.forEach((d) => expList.push(d.data() as ProjectExperiment));
        setExperiments(expList);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/experiments`);
        } catch (e) {
          // Handled
        }
        setExperiments([]);
      }
    );

    return () => {
      unsubEvents();
      unsubInsights();
      unsubExp();
    };
  }, [user, currentProject?.id, currentProject?.ownerId]);

  // 3. Assemble graph nodes and edges strictly from real project definition & experiments
  useEffect(() => {
    if (!currentProject) {
      setGraphNodes([]);
      setGraphEdges([]);
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
        headers: await authenticatedHeaders(),
        body: JSON.stringify({ repository, branch }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to analyze repository");
      }

      const data = await res.json();
      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

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
        createdAt: now,
        updatedAt: now,
      };

      // 1. Save project document in Firestore
      await setDoc(doc(db, "projects", projectId), newProject);
      await setDoc(doc(db, "projects", projectId, "snapshots", `snapshot_${Date.now()}`), {
        projectId, ownerId: user.uid, createdAt: now, branch: data.project.branch,
        graphNodes: data.graphNodes || [], graphEdges: data.graphEdges || [], analysis: data.analysis || null,
      });

      // 2. Persist real commits into events subcollection
      for (const ev of data.events || []) {
        const evId = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await setDoc(doc(db, "projects", projectId, "events", evId), {
          ...ev,
          id: evId,
          projectId,
          ownerId: user.uid,
        });
      }

      // 3. Persist grounded insights into insights subcollection
      for (const ins of data.insights || []) {
        const insId = `ins_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await setDoc(doc(db, "projects", projectId, "insights", insId), {
          ...ins,
          id: insId,
          projectId,
          ownerId: user.uid,
          createdAt: now,
        });
      }

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

    try {
      await setDoc(doc(db, "projects", currentProject.id, "events", evId), fullEvent);
      await updateCurrentProject({ updatedAt: new Date().toISOString() });
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, `projects/${currentProject.id}/events/${evId}`);
      } catch (e) {
        // Logged
      }
    }
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

    try {
      await setDoc(doc(db, "projects", currentProject.id, "insights", insId), fullInsight);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, `projects/${currentProject.id}/insights/${insId}`);
      } catch (e) {
        // Logged
      }
    }
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

    try {
      await setDoc(doc(db, "projects", currentProject.id, "experiments", expId), fullExp);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, `projects/${currentProject.id}/experiments/${expId}`);
      } catch (e) {
        // Logged
      }
    }
  };

  // Update experiment status
  const updateExperimentStatus = async (id: string, status: ProjectExperiment["status"]) => {
    if (!currentProject || !user) return;
    try {
      await updateDoc(doc(db, "projects", currentProject.id, "experiments", id), {
        status,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${currentProject.id}/experiments/${id}`);
    }
  };

  // Re-run repository analysis & forensic AI scan
  const refreshAnalysis = async () => {
    if (!currentProject || !user) return;
    setIsAnalyzing(true);
    setScanStage("repository");
    try {
      // 1. Refresh latest repository state from GitHub.
      if (currentProject.repository && currentProject.repository.includes("/")) {
        {
          const res = await fetch("/api/projects/analyze-repository", {
            method: "POST",
            headers: await authenticatedHeaders(),
            body: JSON.stringify({
              repository: currentProject.repository,
              branch: currentProject.branch,
            }),
          });
          if (res.ok) {
            setScanStage("architecture");
            const data = await res.json();
            // Update project nodes and edges if refreshed
            if (data.graphNodes && data.graphNodes.length > 0) {
              await setDoc(doc(db, "projects", currentProject.id, "snapshots", `snapshot_${Date.now()}`), {
                projectId: currentProject.id, ownerId: user.uid, createdAt: new Date().toISOString(),
                branch: currentProject.branch, graphNodes: data.graphNodes, graphEdges: data.graphEdges || [], analysis: data.analysis || null,
              });
              await updateCurrentProject({
                graphNodes: data.graphNodes,
                graphEdges: data.graphEdges || [],
                framework: data.project.framework,
                language: data.project.language,
                stars: data.project.stars,
                openIssues: data.project.openIssues,
              });
            }

            // Sync new insights if any
            for (const ins of data.insights || []) {
              await addInsight(ins);
            }
          }
        } catch (repoErr) {
          throw repoErr;
        }
      }

      // 2. Run Gemini deep forensic scan
      setScanStage("insights");
      const res = await fetch("/api/gemini/analyze-insights", {
        method: "POST",
        headers: await authenticatedHeaders(),
        body: JSON.stringify({
          projectId: currentProject.id,
        }),
      });
      const data = await res.json();
      if (data.insights && Array.isArray(data.insights)) {
        for (const ins of data.insights) {
          await addInsight(ins);
        }
      }
      setScanStage("completed");
      setTimeout(() => setScanStage("idle"), 1000);
    } catch (e) {
      console.error("Failed to refresh analysis:", e);
      setScanStage("idle");
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
