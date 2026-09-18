import { getAdminFirestore } from "./auth.js";

export async function loadProjectContext(projectId: string, uid: string) {
  const db = getAdminFirestore();
  const projectSnap = await db.collection("projects").doc(projectId).get();
  if (!projectSnap.exists || projectSnap.data()?.ownerId !== uid) return null;
  const [eventsSnap, insightsSnap, experimentsSnap, memorySnap] = await Promise.all([
    projectSnap.ref.collection("events").get(),
    projectSnap.ref.collection("insights").get(),
    projectSnap.ref.collection("experiments").get(),
    projectSnap.ref.collection("memoryEntries").get(),
  ]);
  const project = projectSnap.data() || {};
  return {
    project: { ...project, id: projectId },
    timeline: eventsSnap.docs.map((doc) => doc.data()),
    insights: insightsSnap.docs.map((doc) => doc.data()),
    experiments: experimentsSnap.docs.map((doc) => doc.data()),
    memoryEntries: memorySnap.docs.map((doc) => doc.data()),
    graphNodes: project.graphNodes || [],
    graphEdges: project.graphEdges || [],
  };
}
