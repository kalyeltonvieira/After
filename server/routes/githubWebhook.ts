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