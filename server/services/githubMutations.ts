export type GitHubRequest = (
  path: string,
  token?: string,
  init?: RequestInit,
) => Promise<{ body: any; response?: Response }>;

export async function createGitHubBranch(
  request: GitHubRequest,
  owner: string,
  repo: string,
  name: string,
  from: string,
  token?: string,
) {
  const { body: refData } = await request(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(from)}`,
    token,
  );
  const sha = refData?.object?.sha;
  if (!sha) {
    throw Object.assign(new Error("GitHub did not return a commit SHA for the base branch."), { status: 502 });
  }

  const { body } = await request(`/repos/${owner}/${repo}/git/refs`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${name}`, sha }),
  });
  return body;
}

export async function deleteGitHubBranch(
  request: GitHubRequest,
  owner: string,
  repo: string,
  name: string,
  token?: string,
) {
  await request(
    `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(name)}`,
    token,
    { method: "DELETE" },
  );
}
