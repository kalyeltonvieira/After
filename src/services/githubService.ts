import { authenticatedHeaders } from "../lib/api";

/**
 * Client-side GitHub Service for the AFTER platform
 * Interacts with the backend OAuth setup and GitHub API proxy routes
 * to allow users to link their repositories seamlessly.
 */

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
    headers: await authenticatedHeaders(),
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

/**
 * Fetch authenticated GitHub user details
 */
export async function getConnectedGitHubUser(): Promise<GitHubUser> {
  const res = await fetch("/api/projects/github-user", { credentials: "include", headers: await authenticatedHeaders() });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Failed to load GitHub user profile.");
  }

  return data.user;
}

/**
 * List repositories accessible to the user
 */
export async function listUserRepositories(): Promise<GitHubRepositoryItem[]> {
  const res = await fetch("/api/projects/github-repos", { credentials: "include", headers: await authenticatedHeaders() });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Failed to load user repositories.");
  }

  return data.repos || [];
}

/**
 * List branches for a specific repository
 */
export async function listRepositoryBranches(
  repository: string,
): Promise<GitHubBranchItem[]> {
  const params = new URLSearchParams({ repository });

  const res = await fetch(`/api/projects/github-branches?${params.toString()}`, { credentials: "include", headers: await authenticatedHeaders() });
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
    headers: await authenticatedHeaders(),
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
    headers: await authenticatedHeaders(),
    body: JSON.stringify({ repository, branch }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Repository analysis failed.");
  }

  return data;
}
