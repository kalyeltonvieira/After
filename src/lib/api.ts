import { auth } from "./firebase";

const GITHUB_SESSION_STORAGE_KEY = "after.github.access_token";

function getCachedGitHubAccessToken(): string | null {
  try {
    return sessionStorage.getItem(GITHUB_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function authenticatedHeaders(
  extra: Record<string, string> = {},
  includeGitHubToken = false
) {
  const token = await auth.currentUser?.getIdToken();
  const githubAccessToken = includeGitHubToken ? getCachedGitHubAccessToken() : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(githubAccessToken ? { "X-GitHub-Access-Token": githubAccessToken } : {}),
    ...extra,
  };
}
