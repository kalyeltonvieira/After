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