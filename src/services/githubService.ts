import { authenticatedHeaders } from "../lib/api";

/**
 * Client-side GitHub Service for the AFTER platform
 * Interacts with the backend OAuth setup and GitHub API proxy routes
 * to allow users to link their repositories seamlessly.
 */

// Deprecated client-side helpers kept as no-op stubs for backwards compatibility
export const GITHUB_SESSION_STORAGE_KEY = "after.github.access_token";

export function getCachedGitHubAccessToken(): string | null {
  return null;
}

export function cacheGitHubAccessToken(_token: string): void {
  // No-op: Tokens must never be stored in client-accessible localStorage/sessionStorage
}

export function clearCachedGitHubAccessToken(): void {
  try {
    sessionStorage.removeItem(GITHUB_SESSION_STORAGE_KEY);
    sessionStorage.removeItem("github_token");
    sessionStorage.removeItem("after_github_token");
  } catch {}
  try {
    localStorage.removeItem(GITHUB_SESSION_STORAGE_KEY);
    localStorage.removeItem("github_token");
    localStorage.removeItem("after_github_token");
  } catch {}
}

async function githubRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const authHeaders = await authenticatedHeaders();
  Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value));
  return fetch(path, { ...init, credentials: "include", headers });
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
}

export interface GitHubRepositoryItem {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  updated_at: string;
  pushed_at: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  license?: { key?: string; name?: string; spdx_id?: string | null } | null;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubBranchItem {
  name: string;
  commit: {
    sha: string;
  };
  protected: boolean;
}

export interface OAuthUrlResponse {
  configured: boolean;
  url?: string;
  redirectUri?: string;
  message?: string;
}

export interface LinkRepositoryPayload {
  repository: string;
  branch?: string;
}

export interface LinkRepositoryResponse {
  success: boolean;
  repository: GitHubRepositoryItem;
  defaultBranch: string;
  isPrivate: boolean;
  accessible: boolean;
  webhookConfigured: boolean;
  message: string;
}

/**
 * Fetch the GitHub OAuth Authorization URL from the AFTER backend
 */
export async function getGitHubAuthUrl(): Promise<OAuthUrlResponse> {
  const res = await fetch("/api/projects/github-auth-url", { headers: await authenticatedHeaders() });
  if (!res.ok) {
    throw new Error(`Failed to fetch GitHub auth URL (${res.status})`);
  }
  return res.json();
}

/**
 * Exchange GitHub OAuth code for an access token
 */
export async function exchangeGitHubCode(code: string): Promise<{ connected: boolean }> {
  const res = await fetch("/api/projects/github-exchange", {
    method: "POST",
    headers: await authenticatedHeaders({}, true),
    body: JSON.stringify({ code }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Failed to exchange GitHub authorization code.");
  }

  return { connected: true };
}

/**
 * Open the GitHub OAuth provider URL directly in a popup window (as required by AI Studio iframe constraints)
 * and resolve when the OAuth callback in server/app.ts posts back 'OAUTH_AUTH_SUCCESS'.
 */
export function openGitHubOAuthPopup(authUrl: string): Promise<{ code: string | null; error: string | null }> {
  return new Promise((resolve, reject) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      "github_oauth",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );

    if (!popup) {
      reject(new Error("Popup was blocked by browser. Please allow popups for this site."));
      return;
    }

    // Monitor for callback postMessage
    const handleMessage = (event: MessageEvent) => {
      // Validate origin: accept from same origin or run.app or localhost
      const origin = event.origin;
      const isAllowedOrigin =
        origin === window.location.origin ||
        origin.endsWith(".run.app") ||
        origin.includes("localhost");

      if (!isAllowedOrigin) return;

      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        window.removeEventListener("message", handleMessage);
        clearInterval(closedCheck);
        resolve({
          code: event.data.code || null,
          error: event.data.error || null,
        });
      }
    };

    window.addEventListener("message", handleMessage);

    // Monitor if user closed popup without completing auth
    const closedCheck = setInterval(() => {
      if (popup.closed) {
        clearInterval(closedCheck);
        window.removeEventListener("message", handleMessage);
        resolve({ code: null, error: "Popup was closed by user" });
      }
    }, 800);
  });
}

let memoryCachedUser: GitHubUser | null = null;
let memoryCachedRepos: GitHubRepositoryItem[] | null = null;

export function clearGitHubMemoryCache() {
  memoryCachedUser = null;
  memoryCachedRepos = null;
}

/**
 * Fetch authenticated GitHub user details
 */
export async function getConnectedGitHubUser(forceFresh = false): Promise<GitHubUser> {
  if (!forceFresh && memoryCachedUser) {
    return memoryCachedUser;
  }
  const res = await githubRequest("/api/projects/github-user");

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Failed to load GitHub user profile.");
  }

  memoryCachedUser = data.user;
  return data.user;
}

/**
 * List repositories accessible to the user
 */
export async function listUserRepositories(forceFresh = false): Promise<GitHubRepositoryItem[]> {
  if (!forceFresh && memoryCachedRepos && memoryCachedRepos.length > 0) {
    return memoryCachedRepos;
  }
  const res = await githubRequest("/api/projects/github-repos");

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Failed to load user repositories.");
  }

  memoryCachedRepos = data.repos || [];
  return memoryCachedRepos;
}

/**
 * Search public repositories on GitHub
 */
export async function searchPublicRepositories(
  query: string,
  options?: { per_page?: number; page?: number; sort?: "stars" | "forks" | "updated"; minimumStars?: number; language?: string; license?: string }
): Promise<{ total_count: number; items: GitHubRepositoryItem[] }> {
  const trimmed = query.trim();
  if (!trimmed) return { total_count: 0, items: [] };

  const params = new URLSearchParams({
    q: trimmed,
    ...(options?.sort ? { sort: options.sort } : {}),
    ...(options?.minimumStars ? { minimum_stars: String(options.minimumStars) } : {}),
    ...(options?.language ? { language: options.language } : {}),
    ...(options?.license ? { license: options.license } : {}),
    ...(options?.page ? { page: String(options.page) } : {}),
    ...(options?.per_page ? { per_page: String(options.per_page) } : {}),
  });

  const res = await githubRequest(`/api/projects/github-search?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Failed to search public repositories.");
  }

  return {
    total_count: Number(data.total_count) || 0,
    items: Array.isArray(data.items) ? data.items : [],
  };
}

/**
 * List branches for a specific repository
 */
export async function listRepositoryBranches(
  repository: string,
): Promise<GitHubBranchItem[]> {
  const params = new URLSearchParams({ repository });

  const res = await githubRequest(`/api/projects/github-branches?${params.toString()}`);
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error || "Failed to fetch repository branches.");
  }

  return data.branches || [];
}

/**
 * Link a repository to the AFTER platform
 */
export async function linkRepositoryToAfter(
  payload: LinkRepositoryPayload
): Promise<LinkRepositoryResponse> {
  const res = await fetch("/api/projects/github-link", {
    method: "POST",
    credentials: "include",
    headers: await authenticatedHeaders({}, true),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Failed to link repository to AFTER platform.");
  }

  return data;
}

/**
 * Analyze repository code, history, and architecture
 */
export async function analyzeRepository(
  repository: string,
  branch?: string
): Promise<any> {
  const res = await fetch("/api/projects/analyze-repository", {
    method: "POST",
    headers: await authenticatedHeaders({}, true),
    body: JSON.stringify({ repository, branch }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Repository analysis failed.");
  }

  return data;
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
 * Client-side parser for GitHub repository input strings.
 * Accepts formats:
 * - "owner/repo"
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
 * Validates a repository input and provides user-friendly status and error message
 */
export function validateRepositoryInput(input: string, lang: "en" | "pt" = "en"): {
  isValid: boolean;
  error?: string;
  parsed?: { owner: string; repo: string };
  formatted?: string;
} {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: lang === "pt" ? "Por favor insira um repositório." : "Please enter a repository.",
    };
  }

  const parsed = parseGitHubRepo(trimmed);
  if (!parsed) {
    return {
      isValid: false,
      error:
        lang === "pt"
          ? "Formato inválido. Use 'proprietário/repositório' (ex: facebook/react) ou o link completo do GitHub."
          : "Invalid format. Use 'owner/repo' (e.g. facebook/react) or full GitHub URL.",
    };
  }

  return {
    isValid: true,
    parsed,
    formatted: `${parsed.owner}/${parsed.repo}`,
  };
}
