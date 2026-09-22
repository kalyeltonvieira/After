import { getAdminFirestore } from "./auth.js";
import { loadPersistedGraph } from "./services/graphStore.js";

export async function loadProjectContext(
  projectId: string,
  uid: string
): Promise<{
  project: Record<string, any> & { id: string };
  timeline: any[];
  insights: any[];
  experiments: any[];
  memoryEntries: any[];
  graphNodes: any[];
  graphEdges: any[];
} | null> {
  const db = getAdminFirestore();
  const projectSnap = await db.collection("projects").doc(projectId).get();
  if (!projectSnap.exists || projectSnap.data()?.ownerId !== uid) return null;
  const project = (projectSnap.data() || {}) as Record<string, any>;
  const [graphResult, ...results] = await Promise.allSettled([
    loadPersistedGraph(projectId),
    projectSnap.ref.collection("events").get(),
    projectSnap.ref.collection("insights").get(),
    projectSnap.ref.collection("experiments").get(),
    projectSnap.ref.collection("memoryEntries").get(),
  ]);
  return {
    project: { ...project, id: projectId },
    timeline: results[0].status === "fulfilled" ? results[0].value.docs.map((doc) => doc.data()) : project.events || [],
    insights: results[1].status === "fulfilled" ? results[1].value.docs.map((doc) => doc.data()) : project.insights || [],
    experiments: results[2].status === "fulfilled" ? results[2].value.docs.map((doc) => doc.data()) : project.experiments || [],
    memoryEntries: results[3].status === "fulfilled" ? results[3].value.docs.map((doc) => doc.data()) : project.memoryEntries || [],
    graphNodes: graphResult.status === "fulfilled" && graphResult.value.nodes.length ? graphResult.value.nodes : (project.graphNodes || []),
    graphEdges: graphResult.status === "fulfilled" && graphResult.value.edges.length ? graphResult.value.edges : (project.graphEdges || []),
  };
}