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
 * Parses a GitHub repository string into owner and repo name.
 * Accepts formats:
 * - "owner/repo"
 * - "https://github.com/owner/repo"
 * - "github.com/owner/repo"
 * - "git@github.com:owner/repo.git"
 */
export function parseGitHubRepo(input: string): { owner: string; repo: string } | null {
  if (!input) return null;
  const clean = input.trim().replace(/\.git$/, "").replace(/\/$/, "");

  // URL formats: https://github.com/owner/repo or http://...
  const urlMatch = clean.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  // SSH format: git@github.com:owner/repo
  const sshMatch = clean.match(/github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // Shorthand format: owner/repo
  const parts = clean.split("/");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }

  return null;
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

  return (await res.json()) as GitHubUser;
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
    const repos = (await res.json()) as GitHubRepo[];
    allRepos.push(...repos);
    if (repos.length < perPage) break;
  }
  return allRepos;
}

/**
 * Fetches a single repository's details
 */
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

  return (await res.json()) as GitHubRepo;
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

  return (await res.json()) as GitHubBranch[];
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

  return (await res.json()) as any[];
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

    return (await res.json()) as { sha: string; tree: GitHubTreeItem[] };
  });
}

/**
 * Fetches raw file content from a repository
 */
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