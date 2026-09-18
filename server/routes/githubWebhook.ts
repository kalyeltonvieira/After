import crypto from "node:crypto";
import type { Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { adminApp } from "../auth.js";

type WebhookRequest = Request & { body: Buffer };

function verifySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = signature.slice("sha256=".length);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, "utf8"), Buffer.from(expected, "utf8"));
}

function normalizeRepository(payload: any): string | null {
  const fullName = payload?.repository?.full_name;
  return typeof fullName === "string" && /^[^/]+\/[^/]+$/.test(fullName) ? fullName : null;
}

function buildEventPayload(eventName: string, payload: any) {
  const repo = normalizeRepository(payload);
  const timestamp = new Date().toISOString();

  if (eventName === "push") {
    const commit = payload?.head_commit;
    return {
      event: commit?.message?.split("\n")[0] || `Push to ${payload?.ref || "unknown branch"}`,
      actor: payload?.sender?.login || commit?.author?.name || "GitHub",
      timestamp,
      affectedComponents: commit?.modified || commit?.added || commit?.removed
        ? [...new Set([...(commit?.modified || []), ...(commit?.added || []), ...(commit?.removed || [])])].slice(0, 25)
        : [repo || "repository"],
      reason: `GitHub push event on ${payload?.ref || "unknown branch"}.`,
      metadata: {
        webhookEvent: eventName,
        deliveryId: payload?.deliveryId || null,
        ref: payload?.ref || null,
        before: payload?.before || null,
        after: payload?.after || null,
        commitSha: commit?.id || payload?.after || null,
        repository: repo,
      },
    };
  }

  if (eventName === "pull_request") {
    const pr = payload?.pull_request;
    return {
      event: `Pull request #${pr?.number || payload?.number || "?"}: ${pr?.title || "updated"}`,
      actor: payload?.sender?.login || pr?.user?.login || "GitHub",
      timestamp,
      affectedComponents: [repo || "repository"],
      reason: `GitHub pull_request action: ${payload?.action || "unknown"}.`,
      metadata: {
        webhookEvent: eventName,
        action: payload?.action || null,
        number: pr?.number || payload?.number || null,
        url: pr?.html_url || null,
        repository: repo,
      },
    };
  }

  if (eventName === "issues") {
    const issue = payload?.issue;
    return {
      event: `Issue #${issue?.number || payload?.number || "?"}: ${issue?.title || "updated"}`,
      actor: payload?.sender?.login || issue?.user?.login || "GitHub",
      timestamp,
      affectedComponents: [repo || "repository"],
      reason: `GitHub issues action: ${payload?.action || "unknown"}.`,
      metadata: {
        webhookEvent: eventName,
        action: payload?.action || null,
        number: issue?.number || payload?.number || null,
        url: issue?.html_url || null,
        repository: repo,
      },
    };
  }

  if (eventName === "release") {
    const release = payload?.release;
    return {
      event: `Release ${release?.tag_name || ""} ${payload?.action || "updated"}`.trim(),
      actor: payload?.sender?.login || release?.author?.login || "GitHub",
      timestamp,
      affectedComponents: [repo || "repository"],
      reason: `GitHub release action: ${payload?.action || "unknown"}.`,
      metadata: {
        webhookEvent: eventName,
        action: payload?.action || null,
        tag: release?.tag_name || null,
        url: release?.html_url || null,
        repository: repo,
      },
    };
  }

  return null;
}

export async function githubWebhookHandler(req: WebhookRequest, res: Response) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "GitHub webhook secret is not configured." });

  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({ error: "Raw webhook payload is required." });
  }

  if (!verifySignature(req.body, req.header("x-hub-signature-256") || undefined, secret)) {
    return res.status(401).json({ error: "Invalid webhook signature." });
  }

  const eventName = String(req.header("x-github-event") || "");
  if (!["push", "pull_request", "issues", "release"].includes(eventName)) {
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

  const db = getFirestore(adminApp);
  const projectSnap = await db.collection("projects").where("repository", "==", repository).get();
  const eventPayload = buildEventPayload(eventName, payload);
  if (!eventPayload) return res.status(202).json({ received: true, ignored: true });

  const deliveryId = String(req.header("x-github-delivery") || crypto.randomUUID());

  for (const projectDoc of projectSnap.docs) {
    const project = projectDoc.data();
    const projectId = projectDoc.id;
    const ownerId = project.ownerId;
    if (typeof ownerId !== "string") continue;

    const watchSnap = await projectDoc.ref.collection("watchTargets").limit(25).get();
    const isWatched = watchSnap.docs.some((watch) => {
      const value = watch.data();
      return value.type === "repository" && (!value.target || value.target === repository);
    });

    const eventId = crypto.createHash("sha256")
      .update(`${projectId}:event:${deliveryId}:${eventName}`)
      .digest("hex")
      .slice(0, 32);

    await projectDoc.ref.collection("events").doc(eventId).set({
      ...eventPayload,
      id: eventId,
      projectId,
      ownerId,
      receivedAt: new Date().toISOString(),
    }, { merge: true });

    // Preserve webhook facts in Software Memory as evidence-backed historical entries.
    const memoryId = `webhook_${eventId}`;
    await projectDoc.ref.collection("memoryEntries").doc(memoryId).set({
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
      ],
      source: {
        kind: `github_webhook_${eventName}`,
        id: deliveryId,
        url: eventPayload.metadata?.url || undefined,
      },
      relatedFiles: Array.isArray(eventPayload.affectedComponents) ? eventPayload.affectedComponents : [],
      createdAt: eventPayload.timestamp,
      observedAt: new Date().toISOString(),
    }, { merge: true });

    if (isWatched) {
      const notificationId = crypto.createHash("sha256")
        .update(`${projectId}:notification:${deliveryId}:${eventName}`)
        .digest("hex")
        .slice(0, 32);

      await projectDoc.ref.collection("notifications").doc(notificationId).set({
        id: notificationId,
        projectId,
        ownerId,
        type: eventName,
        title: eventPayload.event,
        body: eventPayload.reason,
        repository,
        createdAt: new Date().toISOString(),
        read: false,
        evidence: eventPayload.metadata,
      }, { merge: true });
    }
  }

  return res.status(202).json({
    received: true,
    event: eventName,
    repository,
    projectsUpdated: projectSnap.size,
  });
}
