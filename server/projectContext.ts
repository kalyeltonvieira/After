import { getAdminFirestore, firebaseProjectId, firestoreDatabaseId } from "./auth.js";
import { loadPersistedGraph } from "./services/graphStore.js";

function decodeValue(val: any): any {
  if (!val || typeof val !== "object") return val;
  if ("stringValue" in val) return val.stringValue;
  if ("booleanValue" in val) return val.booleanValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("timestampValue" in val) return val.timestampValue;
  if ("nullValue" in val) return null;
  if ("arrayValue" in val) return (val.arrayValue?.values || []).map(decodeValue);
  if ("mapValue" in val) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields || {})) {
      res[k] = decodeValue(v);
    }
    return res;
  }
  return val;
}

function decodeFields(fields: any): Record<string, any> {
  if (!fields || typeof fields !== "object") return {};
  const res: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    res[k] = decodeValue(v);
  }
  return res;
}

async function fetchProjectViaRest(projectId: string, token: string): Promise<Record<string, any> | null> {
  if (!firebaseProjectId) return null;
  const dbId = firestoreDatabaseId || "(default)";
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/databases/${encodeURIComponent(dbId)}/documents/projects/${encodeURIComponent(projectId)}`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return decodeFields(data?.fields);
  } catch (err: any) {
    console.warn("Firestore REST fallback failed:", err?.message || err);
    return null;
  }
}

export async function loadProjectContext(
  projectId: string,
  uid: string,
  token?: string
): Promise<{
  project: Record<string, any> & { id: string };
  timeline: any[];
  insights: any[];
  experiments: any[];
  memoryEntries: any[];
  graphNodes: any[];
  graphEdges: any[];
} | null> {
  let project: Record<string, any> | null = null;
  let projectSnap: any = null;

  // 1. Try Firebase Admin SDK first
  try {
    const db = getAdminFirestore();
    const snap = await db.collection("projects").doc(projectId).get();
    if (snap.exists) {
      projectSnap = snap;
      project = snap.data() || {};
    }
  } catch (adminError: any) {
    console.warn("Admin Firestore get failed, trying REST fallback:", adminError?.message || adminError);
  }

  // 2. If Admin SDK did not return data and user token is available, try REST API
  if (!project && token) {
    project = await fetchProjectViaRest(projectId, token);
  }

  if (!project) return null;
  if (project.ownerId && project.ownerId !== uid) return null;

  let timeline: any[] = project.events || [];
  let insights: any[] = project.insights || [];
  let experiments: any[] = project.experiments || [];
  let memoryEntries: any[] = project.memoryEntries || [];
  let graphNodes: any[] = project.graphNodes || [];
  let graphEdges: any[] = project.graphEdges || [];

  if (projectSnap) {
    try {
      const [graphResult, ...results] = await Promise.allSettled([
        loadPersistedGraph(projectId),
        projectSnap.ref.collection("events").get(),
        projectSnap.ref.collection("insights").get(),
        projectSnap.ref.collection("experiments").get(),
        projectSnap.ref.collection("memoryEntries").get(),
      ]);

      if (results[0].status === "fulfilled" && results[0].value.docs) {
        timeline = results[0].value.docs.map((doc: any) => doc.data());
      }
      if (results[1].status === "fulfilled" && results[1].value.docs) {
        insights = results[1].value.docs.map((doc: any) => doc.data());
      }
      if (results[2].status === "fulfilled" && results[2].value.docs) {
        experiments = results[2].value.docs.map((doc: any) => doc.data());
      }
      if (results[3].status === "fulfilled" && results[3].value.docs) {
        memoryEntries = results[3].value.docs.map((doc: any) => doc.data());
      }
      if (graphResult.status === "fulfilled" && graphResult.value.nodes.length) {
        graphNodes = graphResult.value.nodes;
        graphEdges = graphResult.value.edges;
      }
    } catch (subErr: any) {
      console.warn("Subcollection fetch had partial error, using root project fields:", subErr?.message || subErr);
    }
  } else {
    try {
      const persistedGraph = await loadPersistedGraph(projectId);
      if (persistedGraph.nodes.length) {
        graphNodes = persistedGraph.nodes;
        graphEdges = persistedGraph.edges;
      }
    } catch {
      // Ignore
    }
  }

  return {
    project: { ...project, id: projectId },
    timeline,
    insights,
    experiments,
    memoryEntries,
    graphNodes,
    graphEdges,
  };
}