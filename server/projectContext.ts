import { getAdminFirestore, firebaseProjectId, firestoreDatabaseId } from "./auth.js";
import { loadPersistedGraph } from "./services/graphStore.js";

let adminFirestoreKnownUnavailable = false;

export function setAdminFirestoreStatus(available: boolean) {
  adminFirestoreKnownUnavailable = !available;
}

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

export function decodeFields(fields: any): Record<string, any> {
  if (!fields || typeof fields !== "object") return {};
  const res: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    res[k] = decodeValue(v);
  }
  return res;
}

export async function fetchProjectViaRest(projectId: string, token: string): Promise<Record<string, any> | null> {
  if (!firebaseProjectId || !token) return null;
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
  } catch {
    return null;
  }
}

export async function fetchSubcollectionViaRest(
  projectId: string,
  collectionName: string,
  token: string
): Promise<any[]> {
  if (!firebaseProjectId || !token) return [];
  const dbId = firestoreDatabaseId || "(default)";
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/databases/${encodeURIComponent(dbId)}/documents/projects/${encodeURIComponent(projectId)}/${encodeURIComponent(collectionName)}?pageSize=50`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.documents)) return [];
    return data.documents.map((doc: any) => ({
      ...decodeFields(doc.fields),
      id: doc.name ? doc.name.split("/").pop() : undefined,
    }));
  } catch {
    return [];
  }
}

export async function listUserProjectsViaRest(uid: string, token: string): Promise<any[]> {
  if (!firebaseProjectId || !token) return [];
  const dbId = firestoreDatabaseId || "(default)";
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/databases/${encodeURIComponent(dbId)}/documents:runQuery`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "projects" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "ownerId" },
              op: "EQUAL",
              value: { stringValue: uid },
            },
          },
        },
      }),
    });
    if (!response.ok) return [];
    const items = await response.json();
    if (!Array.isArray(items)) return [];
    return items
      .filter((item: any) => Boolean(item.document?.fields))
      .map((item: any) => {
        const doc = item.document;
        const id = doc.name ? doc.name.split("/").pop() : undefined;
        return {
          ...decodeFields(doc.fields),
          id,
        };
      });
  } catch {
    return [];
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

  // 1. If user ID token is provided, prioritize authenticated Firestore REST API
  if (token) {
    project = await fetchProjectViaRest(projectId, token);
  }

  // 2. Try Firebase Admin SDK if token was not provided or REST direct doc returned null
  if (!project && !adminFirestoreKnownUnavailable) {
    try {
      const db = getAdminFirestore();
      const snap = await db.collection("projects").doc(projectId).get();
      if (snap.exists) {
        projectSnap = snap;
        project = snap.data() || {};
      }
    } catch {
      adminFirestoreKnownUnavailable = true;
    }
  }

  // 3. Fallback: Query user's projects via REST if direct document GET missed
  if (!project && token) {
    const userProjects = await listUserProjectsViaRest(uid, token);
    const matched = userProjects.find((p) => p.id === projectId || p.repository === projectId);
    if (matched) {
      project = matched;
    }
  }

  if (!project) return null;
  if (project.ownerId && project.ownerId !== uid) return null;

  let timeline: any[] = Array.isArray(project.events) ? project.events : [];
  let insights: any[] = Array.isArray(project.insights) ? project.insights : [];
  let experiments: any[] = Array.isArray(project.experiments) ? project.experiments : [];
  let memoryEntries: any[] = Array.isArray(project.memoryEntries) ? project.memoryEntries : [];
  let graphNodes: any[] = Array.isArray(project.graphNodes) ? project.graphNodes : [];
  let graphEdges: any[] = Array.isArray(project.graphEdges) ? project.graphEdges : [];

  // If subcollections exist in Firestore and we have token or adminSnap:
  if (token && timeline.length === 0) {
    try {
      const [restEvents, restInsights, restExperiments, restMemory] = await Promise.all([
        fetchSubcollectionViaRest(projectId, "events", token),
        fetchSubcollectionViaRest(projectId, "insights", token),
        fetchSubcollectionViaRest(projectId, "experiments", token),
        fetchSubcollectionViaRest(projectId, "memoryEntries", token),
      ]);
      if (restEvents.length) timeline = restEvents;
      if (restInsights.length) insights = restInsights;
      if (restExperiments.length) experiments = restExperiments;
      if (restMemory.length) memoryEntries = restMemory;
    } catch {
      // Non-blocking fallback to embedded arrays
    }
  } else if (projectSnap) {
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
    } catch {
      // Non-blocking fallback
    }
  }

  // Load persisted graph from store if not already on project
  if (graphNodes.length === 0) {
    try {
      const persisted = await loadPersistedGraph(projectId);
      if (persisted.nodes?.length) {
        graphNodes = persisted.nodes;
        graphEdges = persisted.edges;
      }
    } catch {
      // Non-blocking
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