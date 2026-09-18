
export function changedFilesFromPush(payload: any): string[] {
  return [...new Set([
    ...(Array.isArray(payload?.head_commit?.modified) ? payload.head_commit.modified : []),
    ...(Array.isArray(payload?.head_commit?.added) ? payload.head_commit.added : []),
    ...(Array.isArray(payload?.head_commit?.removed) ? payload.head_commit.removed : []),
  ].filter((value: any) => typeof value === "string" && Boolean(value.trim()))];
}

function branchCandidates(eventName: string, payload: any): string[] {
  if (eventName === "push") {
    const ref = normalizeBranchRef(payload?.ref || "");
    return ref ? [ref] : [];
  }

  if (eventName === "pull_request") {
    return [
      payload?.pull_request?.base?.ref,