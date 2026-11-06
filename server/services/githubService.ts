/**
 * GitHub API Service for AFTER platform
 * Handles OAuth code exchange, repository listing, branch retrieval,
 * commit timeline extraction, and repository linking with the AFTER platform.
 */

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  total_private_repos?: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  html_url: string;
  description: string | null;
  default_branch: string;
  updated_at: string;
  pushed_at: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  permissions?: {
    admin?: boolean;
    push?: boolean;
    pull?: boolean;
  };
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

export interface LinkRepositoryResult {
  success: boolean;
  repository: GitHubRepo;
  defaultBranch: string;
  isPrivate: boolean;
  accessible: boolean;
  webhookConfigured: boolean;
  message: string;
}

/**
 * Validates whether an owner or repository name matches valid GitHub identifier syntax.
 */
export function isValidGitHubIdentifier(val: string): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || trimmed.includes("/")) return false;
  return /^[a-zA-Z0-9_.-]{1,100}$/.test(trimmed);
}

/**
 * Sanitizes GitHub repository URLs and strings into canonical 'owner/repo' format.
 * - Strips protocol prefixes (e.g. 'https://', 'http://', 'git://', 'ssh://', 'git+https://')
 * - Strips domain and credentials prefixes ('github.com/', 'www.github.com/', 'git@github.com:')
 * - Strips path suffixes (e.g. '/tree/main', '/blob/master/...', '/pull/123', trailing slashes)
 * - Strips file extensions ('.git')
 * - Strips query strings ('?tab=readme') and hash fragments ('#readme')
 * - Trims inner and surrounding whitespace
 *
 * Returns canonical 'owner/repo' string if valid, or null if empty or malformed.
 */
export function sanitizeGitHubRepo(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  let clean = input.trim();
  if (!clean) return null;

  // Reject non-GitHub domains if a full URL was provided
  if (/^https?:\/\/|^\w+:\/\//i.test(clean) && !/github\.com/i.test(clean)) {
    return null;
  }

  // Strip query parameters (?...) and hash fragments (#...)
  clean = clean.split("#")[0].split("?")[0].trim();

  // Strip trailing .git and trailing slashes
  clean = clean.replace(/\/+$/, "");
  clean = clean.replace(/\.git$/i, "");
  clean = clean.replace(/\/+$/, "");

  // Strip protocol prefixes
  clean = clean.replace(/^(?:git\+)?(?:https?|ssh|git):\/\//i, "");

  // Strip domain and SSH prefixes
  clean = clean.replace(/^(?:git@)?(?:www\.)?github\.com[:/]/i, "");

  // Strip leading slashes
  clean = clean.replace(/^\/+/, "");

  const segments = clean.split("/").map((s) => s.trim().replace(/\.git$/i, "")).filter(Boolean);
  if (segments.length >= 2) {
    const owner = segments[0];
    const repo = segments[1];
    if (isValidGitHubIdentifier(owner) && isValidGitHubIdentifier(repo)) {
      return `${owner}/${repo}`;
    }
  }

  return null;
}

export const sanitizeGitHubRepository = sanitizeGitHubRepo;

/**
 * Parses a GitHub repository string into owner and repo name.
 * Accepts formats:
 * - "owner/repo"
 * - " owner / repo "
 * - "https://github.com/owner/repo"
 * - "https://github.com/owner/repo/tree/main"
 * - "github.com/owner/repo"
 * - "git@github.com:owner/repo.git"
 */
export function parseGitHubRepo(input: string | null | undefined): { owner: string; repo: string } | null {
  const sanitized = sanitizeGitHubRepo(input);
  if (!sanitized) return null;
  const [owner, repo] = sanitized.split("/");
  return { owner, repo };
}

/**
 * Build standard headers for GitHub API requests
 */
function getGitHubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "AFTER-Software-Evolution-Platform",
  };
  if (token) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

/**
 * Generates the OAuth authorization URL leveraging the server OAuth setup
 */
export function getGitHubOAuthUrl(originUrl?: string): {
  configured: boolean;
  url?: string;
  redirectUri: string;
  message?: string;
} {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const appUrl = originUrl || process.env.APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl.replace(/\/$/, "")}/auth/callback`;

  if (!clientId) {
    return {
      configured: false,
      redirectUri,
      message:
        "GITHUB_CLIENT_ID environment variable is not configured. You can still link public repositories directly or supply a GitHub Personal Access Token.",
    };
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo,read:user,user:email",
    allow_signup: "true",
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  return {
    configured: true,
    url: authUrl,
    redirectUri,
  };
}

/**
 * Exchanges GitHub authorization code for an OAuth access token
 */
export async function exchangeOAuthCode(code: string): Promise<{ token: string; scope?: string }> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GitHub OAuth is not configured on the server (missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET)."
    );
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`GitHub token exchange HTTP error: ${tokenRes.statusText}`);
  }

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }

  if (!tokenData.access_token) {
    throw new Error("GitHub response did not contain an access token.");
  }

  return {
    token: tokenData.access_token,
    scope: tokenData.scope,
  };
}

async function safeJson<T = any>(res: Response, fallbackDesc = "response"): Promise<T | null> {
  try {
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html") || trimmed.startsWith("<")) {
      return null;
    }
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

/**
 * Fetches authenticated GitHub user profile
 */
export async function getAuthenticatedUser(token: string): Promise<GitHubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: getGitHubHeaders(token),
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Invalid or expired GitHub access token.");
    }
    throw new Error(`Failed to fetch GitHub user: ${res.statusText}`);
  }

  const data = await safeJson<GitHubUser>(res, "user profile");
  if (!data) {
    throw new Error(`GitHub returned an HTML page or invalid JSON for user profile (${res.status}).`);
  }
  return data;
}

/**
 * Lists repositories accessible to the authenticated user
 */
export async function listUserRepositories(
  token: string,
  options?: {
    page?: number;
    per_page?: number;
    sort?: "created" | "updated" | "pushed" | "full_name";
    affiliation?: string;
  }
): Promise<GitHubRepo[]> {
  const startPage = options?.page || 1;
  const perPage = Math.min(options?.per_page || 100, 100);
  const sort = options?.sort || "pushed";
  const affiliation = options?.affiliation || "owner,collaborator,organization_member";
  const allRepos: GitHubRepo[] = [];

  for (let page = startPage; ; page += 1) {
    const params = new URLSearchParams({
      page: String(page), per_page: String(perPage), sort, direction: "desc", affiliation,
    });
    const res = await fetch(`https://api.github.com/user/repos?${params.toString()}`, {
      headers: getGitHubHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error("GitHub token is invalid or expired.");
      throw new Error(`Failed to list GitHub repositories: ${res.statusText}`);
    }
    const repos = await safeJson<GitHubRepo[]>(res, "repos list");
    if (Array.isArray(repos)) {
      allRepos.push(...repos);
      if (repos.length < perPage) break;
    } else {
      break;
    }
  }
  return allRepos;
}

/**
 * Searches public repositories on GitHub using GitHub Search API
 */
export async function searchPublicRepositories(
  query: string,
  token?: string,
  options?: { per_page?: number; page?: number; sort?: "stars" | "forks" | "updated" }
): Promise<{ total_count: number; items: GitHubRepo[] }> {
  const trimmed = query.trim();
  if (!trimmed) return { total_count: 0, items: [] };

  const perPage = Math.min(Math.max(Number(options?.per_page) || 20, 1), 50);
  const page = Math.max(Number(options?.page) || 1, 1);
  const sort = options?.sort || "stars";

  const searchParams = new URLSearchParams({
    q: trimmed,
    sort,
    order: "desc",
    per_page: String(perPage),
    page: String(page),
  });

  const res = await fetch(`https://api.github.com/search/repositories?${searchParams.toString()}`, {
    headers: getGitHubHeaders(token),
  });

  if (!res.ok) {
    if (res.status === 403) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      if (remaining === "0") {
        throw new Error("GitHub API rate limit reached. Connect your GitHub account to continue searching.");
      }
    }
    throw new Error(`GitHub search failed (${res.status}): ${res.statusText}`);
  }

  const data = await safeJson<{ total_count: number; items: GitHubRepo[] }>(res, "repository search");
  return {
    total_count: Number(data?.total_count) || 0,
    items: Array.isArray(data?.items) ? data.items : [],
  };
}

export async function getRepository(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubRepo> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: getGitHubHeaders(token),
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        `Repository '${owner}/${repo}' not found on GitHub. If private, grant OAuth repo access.`
      );
    }
    if (res.status === 403) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      if (remaining === "0") {
        throw new Error("GitHub API rate limit exceeded. Please connect via GitHub OAuth.");
      }
      throw new Error(`Access forbidden to repository '${owner}/${repo}'.`);
    }
    throw new Error(`GitHub API error (${res.status}): ${res.statusText}`);
  }

  const data = await safeJson<GitHubRepo>(res, `repository ${owner}/${repo}`);
  if (!data) {
    throw new Error(`GitHub returned non-JSON/HTML response for repository '${owner}/${repo}'.`);
  }
  return data;
}

/**
 * Fetches available branches for a repository
 */
export async function getRepositoryBranches(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubBranch[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=50`,
    {
      headers: getGitHubHeaders(token),
    }
  );

  if (!res.ok) {
    return [];
  }

  const data = await safeJson<GitHubBranch[]>(res, "branches");
  return Array.isArray(data) ? data : [];
}

/**
 * Fetches recent commits for a repository
 */
export async function getRepositoryCommits(
  owner: string,
  repo: string,
  options?: {
    sha?: string;
    per_page?: number;
    token?: string;
  }
): Promise<any[]> {
  const branch = options?.sha;
  const perPage = options?.per_page || 20;
  const query = new URLSearchParams({ per_page: String(perPage) });
  if (branch) query.set("sha", branch);

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?${query.toString()}`,
    {
      headers: getGitHubHeaders(options?.token),
    }
  );

  if (!res.ok) {
    return [];
  }

  const data = await safeJson<any[]>(res, "commits");
  return Array.isArray(data) ? data : [];
}

/**
 * Fetches repository recursive git tree
 */
export async function getRepositoryTree(
  owner: string,
  repo: string,
  shaOrBranch: string | undefined,
  token?: string
): Promise<{ sha: string; tree: GitHubTreeItem[] }> {
  return getRepository(owner, repo, token).then(async (repository) => {
    const ref = shaOrBranch || repository.default_branch;
    const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(
      ref
    )}?recursive=1`,
    {
      headers: getGitHubHeaders(token),
    }
  );

    if (!res.ok) {
      return { sha: ref, tree: [] };
    }

    const data = await safeJson<{ sha: string; tree: GitHubTreeItem[] }>(res, "tree");
    return data && Array.isArray(data.tree) ? data : { sha: ref, tree: [] };
  });
}

/**
 * Fetches raw file content from a repository
 */
export async function getGitBlobContent(owner: string, repo: string, sha: string, token?: string): Promise<{ content: string; size: number } | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${encodeURIComponent(sha)}`, {
    headers: getGitHubHeaders(token),
  });
  if (!res.ok) return null;
  const data = await safeJson<any>(res, "blob");
  if (data?.encoding !== "base64" || typeof data.content !== "string") return null;
  return {
    content: Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8"),
    size: Number(data.size || 0),
  };
}

async function listDirectoryTree(owner: string, repo: string, path: string, ref: string, token: string | undefined, output: GitHubTreeItem[], visited: Set<string>) {
  const key = path || "/";
  if (visited.has(key)) return;
  visited.add(key);
  const urlPath = path ? `/${path.split("/").map(encodeURIComponent).join("/")}` : "";
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents${urlPath}?ref=${encodeURIComponent(ref)}`, { headers: getGitHubHeaders(token) });
  if (!res.ok) return;
  const items = await safeJson<any[]>(res, "directory items");
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const normalized: GitHubTreeItem = {
      path: String(item.path),
      mode: item.type === "dir" ? "040000" : "100644",
      type: item.type === "dir" ? "tree" : "blob",
      sha: String(item.sha || ""),
      size: typeof item.size === "number" ? item.size : undefined,
      url: String(item.url || ""),
    };
    output.push(normalized);
    if (normalized.type === "tree") await listDirectoryTree(owner, repo, normalized.path, ref, token, output, visited);
  }
}

export async function getCompleteRepositoryTree(owner: string, repo: string, shaOrBranch: string | undefined, token?: string): Promise<{ sha: string; tree: GitHubTreeItem[]; truncated: boolean }> {
  const repository = await getRepository(owner, repo, token);
  const ref = shaOrBranch || repository.default_branch;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, { headers: getGitHubHeaders(token) });
  if (res.ok) {
    const data = await safeJson<any>(res, "tree");
    if (Array.isArray(data?.tree) && data.truncated !== true) return { sha: String(data.sha || ref), tree: data.tree as GitHubTreeItem[], truncated: false };
    if (Array.isArray(data?.tree) && data.tree.length) {
      const output = [...(data.tree as GitHubTreeItem[])];
      const seen = new Set(output.filter(item => item.type === "tree").map(item => item.path));
      for (const directory of [...seen]) await listDirectoryTree(owner, repo, directory, ref, token, output, new Set<string>());
      const deduped = [...new Map(output.map(item => [item.path, item])).values()];
      return { sha: String(data.sha || ref), tree: deduped, truncated: true };
    }
  }
  const output: GitHubTreeItem[] = [];
  await listDirectoryTree(owner, repo, "", ref, token, output, new Set<string>());
  return { sha: ref, tree: output, truncated: true };
}

export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
  token?: string
): Promise<{ content: string; encoding: string; size: number } | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path.replace(
    /^\//,
    ""
  )}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;

  const res = await fetch(url, {
    headers: getGitHubHeaders(token),
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  if (data.content && data.encoding === "base64") {
    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    return {
      content: decoded,
      encoding: "utf-8",
      size: data.size,
    };
  }

  return null;
}

/**
 * Attempts to register a webhook on GitHub for repository push events (if admin rights exist)
 */
export async function registerWebhook(
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string,
  token: string
): Promise<{ registered: boolean; id?: number; error?: string }> {
  const events = ["push", "pull_request", "issues", "release"];

  try {
    const existingRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks?per_page=100`, {
      headers: getGitHubHeaders(token),
    });

    if (existingRes.ok) {
      const hooks = await existingRes.json();
      if (Array.isArray(hooks)) {
        const existing = hooks.find((hook: any) => String(hook?.config?.url || "") === webhookUrl);
        if (existing?.id) {
          const updateRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks/${existing.id}`, {
            method: "PATCH",
            headers: {
              ...getGitHubHeaders(token),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              active: true,
              events,
              config: {
                url: webhookUrl,
                content_type: "json",
                secret,
                insecure_ssl: "0",
              },
            }),
          });

          if (updateRes.ok) return { registered: true, id: Number(existing.id) };
        }
      }
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: "POST",
      headers: {
        ...getGitHubHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "web",
        active: true,
        events,
        config: {
          url: webhookUrl,
          content_type: "json",
          secret,
          insecure_ssl: "0",
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { registered: true, id: data.id };
    }

    const errData = await res.json().catch(() => ({}));
    return { registered: false, error: errData.message || res.statusText };
  } catch (err: any) {
    return { registered: false, error: err.message };
  }
}

/**
 * Links a repository to the AFTER platform:
 * - Validates format
 * - Checks repository accessibility with optional token
 * - Confirms branch and permissions
 * - Optionally attempts webhook setup if server webhook URL is provided
 */
export async function linkRepositoryToAfter(
  repoInput: string,
  token?: string,
  options?: {
    requestedBranch?: string;
    webhookBaseUrl?: string;
  }
): Promise<LinkRepositoryResult> {
  const parsed = parseGitHubRepo(repoInput);
  if (!parsed) {
    throw new Error(
      "Invalid repository format. Please enter as 'owner/repo' or a full GitHub URL (e.g., 'facebook/react' or 'https://github.com/vercel/next.js')."
    );
  }

  const { owner, repo } = parsed;
  const repository = await getRepository(owner, repo, token);

  const defaultBranch = repository.default_branch;

  let webhookConfigured = false;
  if (options?.webhookBaseUrl && token && repository.permissions?.admin && process.env.GITHUB_WEBHOOK_SECRET) {
    const webhookUrl = `${options.webhookBaseUrl.replace(/\/$/, "")}/api/projects/github-webhook`;
    const webhookResult = await registerWebhook(
      owner,
      repo,
      webhookUrl,
      process.env.GITHUB_WEBHOOK_SECRET,
      token
    );
    webhookConfigured = webhookResult.registered;
  }

  return {
    success: true,
    repository,
    defaultBranch,
    isPrivate: repository.private,
    accessible: true,
    webhookConfigured,
    message: `Successfully linked ${repository.full_name} to AFTER platform. Default branch: ${defaultBranch}.`,
  };
}