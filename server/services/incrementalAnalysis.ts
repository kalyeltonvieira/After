export async function enqueueIncrementalAnalysis(input: IncrementalInput) {
  const db = getAdminFirestore();
  const identity = input.commitSha || input.deliveryId || crypto.randomUUID();
  const jobId = `incremental_${crypto.createHash("sha256").update(`${input.projectId}:${identity}`).digest("hex").slice(0, 24)}`;
  const projectRef = db.collection("projects").doc(input.projectId);
  const projectSnapshot = await projectRef.get();
  const projectData = projectSnapshot.data() || {};
  if (!projectSnapshot.exists || projectData.ownerId !== input.ownerId) {
    throw new Error("Project no longer exists or is not owned by the event owner.");
  }

  const existingJobs = Array.isArray(projectData.analysisJobs)
    ? projectData.analysisJobs
    : [];
  const existing = existingJobs.find((job: any) => job.id === jobId);
  if (existing && ["queued", "fetching", "analyzing", "building_graph"].includes(String(existing.status))) {
    return { jobId, queued: false };
  }

  const now = new Date().toISOString();
  const job = {
    id: jobId,
    projectId: input.projectId,
    ownerId: input.ownerId,
    mode: "incremental",
    status: "queued",
    branch: input.branch,