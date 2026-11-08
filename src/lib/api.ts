export async function authenticatedHeaders(
  extra: Record<string, string> = {},
  _includeGitHubToken = false
) {
  return {
    "Content-Type": "application/json",
    ...extra,
  };
}
