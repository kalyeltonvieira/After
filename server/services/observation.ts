export type WatchTargetType = "repository" | "branch" | "file" | "component" | "dependency" | "node";

export const WATCH_TARGET_TYPES: WatchTargetType[] = [
  "repository",
  "branch",
  "file",
  "component",
  "dependency",
  "node",
];

export function normalizeBranchRef(value: string): string {
  return String(value || "").replace(/^refs\/heads\//, "").replace(/^refs\/tags\//, "");
}

export function changedFilesFromPush(payload: any): string[] {
  return [...new Set([
    ...(Array.isArray(payload?.head_commit?.modified) ? payload.head_commit.modified : []),
    ...(Array.isArray(payload?.head_commit?.added) ? payload.head_commit.added : []),
    ...(Array.isArray(payload?.head_commit?.removed) ? payload.head_commit.removed : []),
  ].filter((value: any) => typeof value === "string" && Boolean(value.trim())))];
}

function branchCandidates(eventName: string, payload: any): string[] {
  if (eventName === "push") {
    const ref = normalizeBranchRef(payload?.ref || "");
    return ref ? [ref] : [];
  }

  if (eventName === "pull_request") {
    return [
      payload?.pull_request?.base?.ref,
      payload?.pull_request?.head?.ref,
    ].filter((value: any): value is string => typeof value === "string" && Boolean(value.trim()));
  }

  return [];
}

function nodeMatchesTarget(node: any, _target: string, changedFiles: string[]): boolean {
  if (!node?.filePath) return false;
  return changedFiles.includes(String(node.filePath));
}

export function watchTargetMatches(
  target: { type?: string; target?: string },
  eventName: string,
  payload: any,
  repository: string,
  project: any,
  changedFiles: string[],
): boolean {
  const type = String(target?.type || "");
  const value = String(target?.target || "").trim();

  if (type === "repository") {
    return !value || value === repository;
  }

  if (type === "branch") {
    return branchCandidates(eventName, payload).includes(value);
  }

  if (type === "file") {
    return changedFiles.includes(value);
  }

  const nodes = Array.isArray(project?.graphNodes) ? project.graphNodes : [];

  if (type === "component") {
    const node = nodes.find((item: any) =>
      ["page", "component", "function", "api", "class", "service", "file"].includes(String(item?.type)) &&
      (String(item?.id) === value || String(item?.label).toLowerCase() === value.toLowerCase())
    );
    return nodeMatchesTarget(node, value, changedFiles);
  }

  if (type === "dependency") {
    const node = nodes.find((item: any) =>
      String(item?.type) === "dependency" &&
      (String(item?.dependency || "").toLowerCase() === value.toLowerCase() ||
       String(item?.id) === value ||
       String(item?.label).toLowerCase() === value.toLowerCase())
    );
    if (!node) return false;

    return changedFiles.some((path) =>
      /(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|pyproject\.toml|go\.mod|cargo\.toml)$/.test(path)
    ) || changedFiles.includes(String(node.filePath || ""));
  }

  if (type === "node") {
    const node = nodes.find((item: any) => String(item?.id) === value || String(item?.label).toLowerCase() === value.toLowerCase());
    return nodeMatchesTarget(node, value, changedFiles);
  }

  return false;
}

export function matchingWatchTargets(
  watchTargets: any[],
  eventName: string,
  payload: any,
  repository: string,
  project: any,
  changedFiles: string[],
) {
  return watchTargets.filter((watch) =>
    watchTargetMatches(watch, eventName, payload, repository, project, changedFiles)
  );
}