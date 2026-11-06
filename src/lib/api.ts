import { auth } from "./firebase";

export async function authenticatedHeaders(
  extra: Record<string, string> = {},
  _includeGitHubToken = false
) {
  const token = await auth.currentUser?.getIdToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
