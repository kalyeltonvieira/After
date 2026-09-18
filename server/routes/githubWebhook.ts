import crypto from "node:crypto";
import type { Request, Response } from "express";
import { getAdminFirestore } from "../auth.js";
import { enqueueIncrementalAnalysis } from "../services/incrementalAnalysis.js";
import {
  changedFilesFromPush,
  matchingWatchTargets,
  normalizeBranchRef,
} from "../services/observation.js";

type WebhookRequest = Request & { body: Buffer };

const supportedEvents = new Set(["push", "pull_request", "issues", "release"]);

function verifySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = signature.slice("sha256=".length);
  return actual.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(actual, "utf8"), Buffer.from(expected, "utf8"));
}

function normalizeRepository(payload: any): string | null {
  const fullName = payload?.repository?.full_name;
  return typeof fullName === "string" && /^[^/]+\/[^/]+$/.test(fullName) ? fullName : null;
}

function buildEventPayload(eventName: string, payload: any, deliveryId: string) {
  const repository = normalizeRepository(payload);
  const timestamp = new Date().toISOString();

  if (eventName === "push") {
    const commit = payload?.head_commit;
    const changedFiles = changedFilesFromPush(payload);
    const branch = normalizeBranchRef(payload?.ref || "");

    return {
      event: commit?.message?.split("\n")[0] || (branch ? `Push to ${branch}` : "Repository push"),
      actor: payload?.sender?.login || commit?.author?.name || "GitHub",
      timestamp,
      affectedComponents: changedFiles.slice(0, 25).length ? changedFiles.slice(0, 25) : [repository || "repository"],
      reason: branch ? `GitHub push observed on ${branch}.` : "GitHub repository push observed.",
      metadata: {
        webhookEvent: eventName,
        deliveryId,
        ref: payload?.ref || null,
        branch: branch || null,
        before: payload?.before || null,
        after: payload?.after || null,
        commitSha: commit?.id || payload?.after || null,
        repository,
        changedFiles,
      },
    };
  }

  if (eventName === "pull_request") {
    const pr = payload?.pull_request;
    return {
      event: `Pull request #${pr?.number || payload?.number || "?"}: ${pr?.title || "updated"}`,
      actor: payload?.sender?.login || pr?.user?.login || "GitHub",
      timestamp,
      affectedComponents: [repository || "repository"],
      reason: `GitHub pull_request action: ${payload?.action || "unknown"}.`,
      metadata: {
        webhookEvent: eventName,
        deliveryId,
        action: payload?.action || null,
        number: pr?.number || payload?.number || null,
        baseBranch: pr?.base?.ref || null,
        headBranch: pr?.head?.ref || null,
        url: pr?.html_url || null,
        repository,
      },
    };
  }

  if (eventName === "issues") {
    const issue = payload?.issue;
    return {
      event: `Issue #${issue?.number || payload?.number || "?"}: ${issue?.title || "updated"}`,
      actor: payload?.sender?.login || issue?.user?.login || "GitHub",
      timestamp,
      affectedComponents: [repository || "repository"],
      reason: `GitHub issues action: ${payload?.action || "unknown"}.`,
      metadata: {
        webhookEvent: eventName,
        deliveryId,
        action: payload?.action || null,
        number: issue?.number || payload?.number || null,
        url: issue?.html_url || null,
        repository,
      },
    };
  }

  if (eventName === "release") {
    const release = payload?.release;
    return {
      event: `Release ${release?.tag_name || ""} ${payload?.action || "updated"}`.trim(),
      actor: payload?.sender?.login || release?.author?.login || "GitHub",
      timestamp,
      affectedComponents: [repository || "repository"],
      reason: `GitHub release action: ${payload?.action || "unknown"}.`,
      metadata: {
        webhookEvent: eventName,
        deliveryId,
        action: payload?.action || null,
        tag: release?.tag_name || null,
        url: release?.html_url || null,
        repository,
      },
    };
  }

  return null;
}

export async function githubWebhookHandler(req: WebhookRequest, res: Response) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "GitHub webhook secret is not configured." });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: "Raw webhook payload is required." });

  if (!verifySignature(req.body, req.header("x-hub-signature-256") || undefined, secret)) {
    return res.status(401).json({ error: "Invalid webhook signature." });
  }

  const eventName = String(req.header("x-github-event") || "");
  if (!supportedEvents.has(eventName)) {
    return res.status(202).json({ received: true, ignored: true, event: eventName });
  }

  let payload: any;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Webhook payload is not valid JSON." });
  }

  const repository = normalizeRepository(payload);
  if (!repository) return res.status(202).json({ received: true, ignored: true, reason: "repository missing" });

  const deliveryId = String(req.header("x-github-delivery") || crypto.randomUUID());
  const eventPayload = buildEventPayload(eventName, payload, deliveryId);
  if (!eventPayload) return res.status(202).json({ received: true, ignored: true });

  let projectSnap;
  try {
    projectSnap = await getAdminFirestore().collection("projects").where("repository", "==", repository).get();
  } catch (error: any) {
    console.warn("Could not resolve projects for GitHub webhook:", error?.message || error);
    return res.status(503).json({ error: "Observation storage is temporarily unavailable." });
  }

  let projectsUpdated = 0;

  for (const projectDoc of projectSnap.docs) {
    const project = projectDoc.data();
    const projectId = projectDoc.id;
    const ownerId = project.ownerId;
    if (typeof ownerId !== "string") continue;

    const changedFiles = eventName === "push" ? changedFilesFromPush(payload) : [];
    const watchTargets = Array.isArray(project.watchTargets) ? project.watchTargets : [];
    const matchedTargets = matchingWatchTargets(
      watchTargets,
      eventName,
      payload,
      repository,
      project,
      changedFiles,
    );

    const eventId = crypto.createHash("sha256")
      .update(`${projectId}:event:${deliveryId}:${eventName}`)
      .digest("hex")
      .slice(0, 32);

    const now = new Date().toISOString();
    const events = Array.isArray(project.events) ? project.events : [];
    const nextEvent = {
      ...eventPayload,
      id: eventId,
      projectId,
      ownerId,
      receivedAt: now,
    };
    const nextEvents = [
      nextEvent,
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

    const update = {
      events: nextEvents,
      memoryEntries: nextMemory,
      updatedAt: now,
    };

    let incrementalJobId: string | null = null;

    if (eventName === "push") {
      const branch = normalizeBranchRef(eventPayload.metadata?.ref || "");
      const removedFiles = Array.isArray(payload?.head_commit?.removed)
        ? payload.head_commit.removed.filter((file: any) => typeof file === "string")
        : [];

      if (branch && changedFiles.length + removedFiles.length > 0 && (!project.branch || project.branch === branch)) {
        try {
          const queued = await enqueueIncrementalAnalysis({
            projectId,
            ownerId,
            branch,
            changedFiles,
            removedFiles,
            commitSha: String(eventPayload.metadata?.commitSha || ""),
            deliveryId,
          });
          incrementalJobId = queued.jobId;
        } catch (error: any) {
          console.warn("Could not enqueue incremental analysis:", error?.message || error);
        }
      }
    }

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
      await projectDoc.ref.set(update, { merge: true });
      projectsUpdated += 1;
    } catch (error: any) {
      console.warn(`Could not persist webhook event for ${projectId}:`, error?.message || error);
    }
  }

  return res.status(202).json({
    received: true,
    event: eventName,
    repository,
    deliveryId,
    projectsUpdated,
  });
}
