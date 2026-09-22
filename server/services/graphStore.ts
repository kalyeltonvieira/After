import { getAdminFirestore } from "../auth.js";

const safeId = (value: string) => value.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 120);

export async function persistGraphSnapshot(projectId: string, nodes: any[], edges: any[], analysisVersion = "graph-v2") {
  const db = getAdminFirestore();
  const projectRef = db.collection("projects").doc(projectId);
  const writes: Array<{ ref: any; data: any }> = [];
  for (const node of nodes.slice(0, 20000)) {
    writes.push({ ref: projectRef.collection("graphNodes").doc(safeId(String(node.id))), data: { ...node, analysisVersion, updatedAt: new Date().toISOString() } });
  }
  for (const edge of edges.slice(0, 40000)) {
    const id = safeId(String(edge.from) + ":" + String(edge.to) + ":" + String(edge.label || ""));
    writes.push({ ref: projectRef.collection("graphEdges").doc(id), data: { ...edge, id, analysisVersion, updatedAt: new Date().toISOString() } });
  }
  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    for (const write of writes.slice(i, i + 450)) batch.set(write.ref, write.data, { merge: true });
    await batch.commit();
  }
  await projectRef.set({ graphVersion: analysisVersion, graphNodeCount: nodes.length, graphEdgeCount: edges.length, graphUpdatedAt: new Date().toISOString() }, { merge: true });
}

export async function loadPersistedGraph(projectId: string) {
  const ref = getAdminFirestore().collection("projects").doc(projectId);
  const [nodes, edges] = await Promise.all([
    ref.collection("graphNodes").limit(20000).get(),
    ref.collection("graphEdges").limit(40000).get(),
  ]);
  return { nodes: nodes.docs.map(doc => doc.data()), edges: edges.docs.map(doc => doc.data()) };
}
