      ...events.filter((item: any) => item.id !== eventId),
    ].slice(0, 250);

    const memoryId = `webhook_${eventId}`;
    const memory = Array.isArray(project.memoryEntries) ? project.memoryEntries : [];
    const memoryEntry = {
      id: memoryId,
      projectId,
      ownerId,
      type: eventName === "pull_request" ? "pull_request" : eventName === "issues" ? "issue" : eventName === "release" ? "release" : "commit",
      title: eventPayload.event,
      summary: eventPayload.reason,
      status: "KNOWN",
      evidence: [
        `GitHub webhook event: ${eventName}`,
        ...(Array.isArray(eventPayload.affectedComponents) ? eventPayload.affectedComponents.slice(0, 10) : []),
        ...(eventPayload.metadata?.commitSha ? [`Commit: ${eventPayload.metadata.commitSha}`] : []),
      ],
      source: {
        kind: `github_webhook_${eventName}`,
        id: deliveryId,
        url: eventPayload.metadata?.url || undefined,
      },
      relatedFiles: changedFiles.slice(0, 50),
      createdAt: eventPayload.timestamp,
      observedAt: now,
    };
    const nextMemory = [
      memoryEntry,
      ...memory.filter((entry: any) => entry.id !== memoryId),
    ].slice(0, 250);

    const update: Record<string, any> = {
      events: nextEvents,
      memoryEntries: nextMemory,
      updatedAt: now,
    };

    if (matchedTargets.length > 0) {
      const notificationId = crypto.createHash("sha256")
        .update(`${projectId}:notification:${deliveryId}:${eventName}`)
        .digest("hex")
        .slice(0, 32);

      const notifications = Array.isArray(project.notifications) ? project.notifications : [];
      const notification = {
        id: notificationId,
        projectId,
        ownerId,
        type: eventName,
        title: eventPayload.event,
        body: eventPayload.reason,
        repository,
        createdAt: now,
        read: false,
        evidence: {
          ...eventPayload.metadata,
          matchedWatchTargets: matchedTargets.map((watch: any) => ({
            type: watch.type,
            target: watch.target,
          })),
        },
      };
      update.notifications = [
        notification,
        ...notifications.filter((item: any) => item.id !== notificationId),
      ].slice(0, 100);
    }

    try {
      // Persist the webhook fact before starting the worker so incremental
      // analysis always observes the event/memory state that triggered it.
      await projectDoc.ref.set(update, { merge: true });
      projectsUpdated += 1;
    } catch (error: any) {
      console.warn(`Could not persist webhook event for ${projectId}:`, error?.message || error);
      continue;
    }

    if (eventName === "push") {
      const branch = normalizeBranchRef(eventPayload.metadata?.ref || "");
      const removedFiles = Array.isArray(payload?.head_commit?.removed)
        ? payload.head_commit.removed.filter((file: any) => typeof file === "string")
        : [];

      if (branch && changedFiles.length + removedFiles.length > 0 && (!project.branch || project.branch === branch)) {