import type { ProjectEvent, SoftwareMemoryEntry } from "../types";

/**
 * Removes undefined values before Firestore writes without mutating the input.
 * Special Firebase objects, Dates, and other non-plain instances are preserved.
 */
export function sanitizeFirestoreData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as T;
  }

  if (value === null || typeof value !== "object") return value;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => [key, sanitizeFirestoreData(item)] as const);

  return Object.fromEntries(entries) as T;
}

/**
 * Build Software Memory records only from events proven to be GitHub commits.
 * Issues, pull requests, and releases are already represented by their own
 * typed memory entries and must never be relabelled as commits.
 */
export function buildCommitMemoryEntries(
  events: ProjectEvent[],
  projectId: string,
  existing: SoftwareMemoryEntry[],
  observedAt: string
): SoftwareMemoryEntry[] {
  const knownSources = new Set(
    existing.map((entry) => entry.source?.id).filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  const additions: SoftwareMemoryEntry[] = [];

  for (const event of events) {
    const metadata = event.metadata || {};
    const isCommitEvent = metadata.type === "commit" || (!metadata.type && event.id.startsWith("commit_"));
    if (!isCommitEvent) continue;

    const shaValue = metadata.fullSha || metadata.sha;
    if (typeof shaValue !== "string" || !shaValue.trim()) continue;
    const sourceId = shaValue.trim();
    if (knownSources.has(sourceId)) continue;
    knownSources.add(sourceId);

    const safeId = sourceId.replace(/[^A-Za-z0-9_-]/g, "");
    if (!safeId) continue;

    additions.push({
      id: `commit_${safeId}`,
      projectId,
      type: "commit",
      title: event.event || "GitHub commit",
      summary: event.reason || event.event || "Commit observed in GitHub.",
      status: "KNOWN",
      evidence: [
        `Commit ${sourceId}`,
        ...(Array.isArray(event.affectedComponents) ? event.affectedComponents.slice(0, 10) : []),
      ],
      source: {
        kind: "github_commit",
        id: sourceId,
        ...(typeof metadata.url === "string" && metadata.url ? { url: metadata.url } : {}),
      },
      relatedFiles: Array.isArray(event.affectedComponents) ? event.affectedComponents : [],
      createdAt: event.timestamp || observedAt,
      observedAt,
    });
  }

  return additions;
}
