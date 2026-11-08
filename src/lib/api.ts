import { getStoredToken } from "./auth";

export async function authenticatedHeaders(
  extra: Record<string, string> = {},
  _includeGitHubToken = false
) {
  const token = getStoredToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
