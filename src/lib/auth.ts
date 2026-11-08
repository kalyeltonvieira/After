import { useState, useEffect, useCallback } from "react";
import { getInitialsAvatar } from "./avatar";

export interface GitHubAuthUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  bio?: string | null;
  // Compatibility fields
  uid: string;
  displayName: string | null;
  photoURL: string;
}

const USER_STORAGE_KEY = "after_github_user";
const TOKEN_STORAGE_KEY = "after_github_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function getStoredUser(): GitHubAuthUser | null {
  try {
    const data = localStorage.getItem(USER_STORAGE_KEY);
    return data ? enrichGitHubUser(JSON.parse(data)) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: GitHubAuthUser | null) {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(enrichGitHubUser(user)));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

/**
 * Simple hook for GitHub authentication state using localStorage.
 * No Providers required. Reactivity handled by a custom event or local state.
 */
export function useAuth() {
  const [user, setUserState] = useState<GitHubAuthUser | null>(getStoredUser);
  const [loading, setLoading] = useState(false);

  // Sync state if localStorage changes in other tabs
  useEffect(() => {
    const handleStorage = () => {
      setUserState(getStoredUser());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const loginWithGitHub = useCallback(async () => {
    try {
      const response = await fetch("/api/projects/github-auth-url");
      const data = await response.json();
      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to get auth URL");
      }
    } catch (err) {
      console.error("Login error:", err);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUserState(null);
    
    try {
      await fetch("/api/projects/github-session/revoke", { method: "POST" });
    } catch {}
    
    window.location.href = "/";
  }, []);

  const connectGitHub = loginWithGitHub;

  const updateUserProfile = useCallback(async (data: any) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setStoredUser(updated);
    setUserState(updated);
  }, [user]);

  const deleteUserAccount = signOut;

  return {
    user,
    loading,
    loginWithGitHub,
    connectGitHub,
    signOut,
    updateUserProfile,
    deleteUserAccount,
    isGitHubConnected: Boolean(user),
    profile: user ? {
      id: user.login,
      email: user.email || "",
      displayName: user.name || user.login,
      username: user.login,
      photoURL: user.avatar_url,
      bio: user.bio || "",
      createdAt: new Date().toISOString(),
      preferences: {
        theme: "system",
        notifications: true,
        autoAnalysis: true,
        weeklySummary: true,
        experimentalFeatures: false,
      },
    } : null,
  };
}

export function enrichGitHubUser(raw: any): GitHubAuthUser {
  const login = raw?.login || "github-user";
  const name = raw?.name || login;
  const avatar = raw?.avatar_url || raw?.photoURL || getInitialsAvatar(login);

  return {
    id: Number(raw?.id) || 1,
    login,
    name,
    email: raw?.email || null,
    avatar_url: avatar,
    html_url: raw?.html_url || `https://github.com/${login}`,
    public_repos: Number(raw?.public_repos) || 0,
    bio: raw?.bio || null,
    // Compatibility fields
    uid: login,
    displayName: name,
    photoURL: avatar,
  };
}
