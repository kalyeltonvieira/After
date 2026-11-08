import React, { createContext, useContext, useEffect, useState } from "react";
import { UserProfile, UserPreferences } from "../types";
import { getInitialsAvatar } from "../lib/avatar";

export interface GitHubAuthUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  bio?: string | null;
  // Compatibility fields for legacy consumers
  uid: string;
  displayName: string | null;
  photoURL: string;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

interface AuthContextType {
  user: GitHubAuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  needsOnboarding: boolean;
  setNeedsOnboarding: (val: boolean) => void;
  isGitHubConnected: boolean;
  loginWithGitHub: () => Promise<GitHubAuthUser>;
  connectGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: (data: {
    username: string;
    displayName: string;
    bio?: string;
  }) => Promise<void>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  deleteUserAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  notifications: true,
  autoAnalysis: true,
  weeklySummary: true,
  experimentalFeatures: false,
};

const CACHED_USER_KEY = "after_github_user_cache";

function enrichGitHubUser(raw: any): GitHubAuthUser {
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
    getIdToken: async () => "",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GitHubAuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(CACHED_USER_KEY);
      return saved ? enrichGitHubUser(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(CACHED_USER_KEY);
      if (saved) {
        const u = JSON.parse(saved);
        return {
          id: u.login,
          email: u.email || "",
          displayName: u.name || u.login,
          username: u.login,
          photoURL: u.avatar_url,
          bio: u.bio || "",
          createdAt: new Date().toISOString(),
          preferences: DEFAULT_PREFERENCES,
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Restore authenticated session from backend on mount
  useEffect(() => {
    let active = true;

    async function checkCurrentSession() {
      try {
        const res = await fetch("/api/projects/github-user", {
          credentials: "include",
        });

        if (!active) return;

        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            const enriched = enrichGitHubUser(data.user);
            setUser(enriched);
            localStorage.setItem(CACHED_USER_KEY, JSON.stringify(data.user));
            setProfile({
              id: enriched.login,
              email: enriched.email || "",
              displayName: enriched.name || enriched.login,
              username: enriched.login,
              photoURL: enriched.avatar_url,
              bio: enriched.bio || "",
              createdAt: new Date().toISOString(),
              preferences: DEFAULT_PREFERENCES,
            });
            setLoading(false);
            return;
          }
        } else if (res.status === 401) {
          // If server rejects session, clean local cache
          localStorage.removeItem(CACHED_USER_KEY);
          setUser(null);
          setProfile(null);
        }
      } catch {
        // Keep cached state if offline or transient failure
      } finally {
        if (active) setLoading(false);
      }
    }

    void checkCurrentSession();

    return () => {
      active = false;
    };
  }, []);

  const loginWithGitHub = async (): Promise<GitHubAuthUser> => {
    try {
      const response = await fetch("/api/projects/github-auth-url");
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.url) {
        window.location.href = data.url;
        // The page redirects, but we return a never-resolving promise to prevent
        // the caller from proceeding in the current execution context.
        return new Promise(() => {});
      } else {
        throw new Error(data.error || "Não foi possível obter a URL de autorização.");
      }
    } catch (err: any) {
      throw err;
    }
  };

  const connectGitHub = async (): Promise<void> => {
    await loginWithGitHub();
  };

  const signOut = async () => {
    try {
      await fetch("/api/projects/github-session/revoke", {
        method: "POST",
        credentials: "include",
      }).catch(() => undefined);
    } finally {
      localStorage.removeItem(CACHED_USER_KEY);
      sessionStorage.clear();
      setUser(null);
      setProfile(null);
      setNeedsOnboarding(false);
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    setProfile((prev) => (prev ? { ...prev, ...data } : null));
  };

  const completeOnboarding = async (data: {
    username: string;
    displayName: string;
    bio?: string;
  }) => {
    setProfile((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        username: data.username,
        displayName: data.displayName,
        bio: data.bio || prev.bio,
      };
    });
    setNeedsOnboarding(false);
  };

  const checkUsernameAvailable = async (_username: string): Promise<boolean> => {
    return true;
  };

  const deleteUserAccount = async () => {
    await signOut();
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        needsOnboarding,
        setNeedsOnboarding,
        isGitHubConnected: Boolean(user),
        loginWithGitHub,
        connectGitHub,
        signOut,
        updateUserProfile,
        completeOnboarding,
        checkUsernameAvailable,
        deleteUserAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
