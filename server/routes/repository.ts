});

repositoryRouter.delete("/watch/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { db } = await getProjectRepository(req, String(req.query.projectId || ""));
    const projectId = String(req.query.projectId);
    const id = String(req.params.id);
    const projectRef = db.collection("projects").doc(projectId);
    const snap = await projectRef.get();
    const data = snap.data() || {};
    const current = Array.isArray(data.watchTargets) ? data.watchTargets : [];
    const next = current.filter((watch: any) => watch.id !== id);
    await projectRef.set({ watchTargets: next, updatedAt: new Date().toISOString() }, { merge: true });
    return res.json({ watching: false, watchTargets: next });
  } catch (error) { return handleRouteError(res, error); }
});
