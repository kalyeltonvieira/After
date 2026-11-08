import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  linkWithCredential,
  EmailAuthProvider,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  testConnection,
} from "../lib/firebase";
import { UserProfile, UserPreferences } from "../types";
import { getInitialsAvatar } from "../lib/avatar";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  needsOnboarding: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  connectGitHub: () => Promise<void>;
  addEmailPassword: (email: string, password: string) => Promise<void>;
  isGitHubConnected: boolean;
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

const GITHUB_SESSION_STORAGE_KEY = "after.github.access_token";

function cacheGitHubAccessToken(_token: string) {
  // No-op: Tokens are secured server-side only
}

function clearCachedGitHubAccessToken() {
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


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const onboardingCompletedUidRef = React.useRef<string | null>(null);

  useEffect(() => {
    void testConnection();
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        onboardingCompletedUidRef.current = null;
      }

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (currentUser) {
        // Immediately unblock app loading while profile is fetched in background
        setLoading(false);

        const userDocRef = doc(db, "users", currentUser.uid);

        unsubscribeProfile = onSnapshot(
          userDocRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserProfile;
              setProfile(data);
              if (data.username) {
                onboardingCompletedUidRef.current = currentUser.uid;
                setNeedsOnboarding(false);
              } else if (onboardingCompletedUidRef.current !== currentUser.uid) {
                setNeedsOnboarding(true);
              }
            } else if (onboardingCompletedUidRef.current !== currentUser.uid) {
              setProfile(null);
              setNeedsOnboarding(true);
            }
          },
          (error) => {
            console.warn("Could not fetch user profile from Firestore (quota or permission issue):", error?.message);
          }
        );
      } else {
        setProfile(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const establishGitHubSession = async (firebaseUser: User, githubAccessToken: string) => {
    const idToken = await firebaseUser.getIdToken(true);
    const response = await fetch("/api/projects/github-session", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ githubAccessToken }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        data.error || "Sua conta AFTER está ativa, mas não foi possível concluir a conexão com o GitHub. Tente conectar novamente."
      );
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    await signInWithEmailAndPassword(auth, cleanEmail, password);
  };

  const createAccount = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    await createUserWithEmailAndPassword(auth, cleanEmail, password);
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) throw new Error("Informe seu e-mail para receber o link de redefinição.");
    await sendPasswordResetEmail(auth, cleanEmail);
  };

  // GitHub is an integration linked to the signed-in AFTER identity, not the identity itself.
  const connectGitHub = async () => {
    if (!user) throw new Error("Entre na sua conta AFTER antes de conectar o GitHub.");

    try {
      const response = await fetch("/api/projects/github-auth-url", {
        headers: {
            Authorization: `Bearer ${await user.getIdToken()}`
        }
      });
      if (!response.ok) throw new Error("Failed to initiate GitHub OAuth.");
      const { url } = await response.json();

      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) throw new Error('Please allow popups for this site to connect your GitHub account.');
      
      return new Promise<void>((resolve, reject) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
            window.removeEventListener('message', handleMessage);
            resolve();
          }
        };
        window.addEventListener('message', handleMessage);
      });
    } catch (error: any) {
      throw error;
    }
  };

  // Allows legacy GitHub-only accounts to add an email/password login without losing their UID.
  const addEmailPassword = async (email: string, password: string) => {
    if (!user) throw new Error("Entre na sua conta AFTER antes de adicionar e-mail e senha.");
    const credential = EmailAuthProvider.credential(email.trim().toLowerCase(), password);
    const result = await linkWithCredential(user, credential);
    setUser(result.user);
  };


  const signOut = async () => {
    try {
      await fetch("/api/projects/github-session/revoke", {
        method: "POST",
        credentials: "include",
      }).catch(() => undefined);
      clearCachedGitHubAccessToken();
      await firebaseSignOut(auth);
      setProfile(null);
      setNeedsOnboarding(false);
    } catch (error: any) {
      console.error("Sign out error:", error);
      throw error;
    }
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const clean = username.toLowerCase().trim();
    if (!clean || clean.length < 3) return false;

    try {
      const res = await fetch(
        `/api/projects/validate-username?username=${encodeURIComponent(clean)}`
      );
      const data = await res.json();
      if (!data.valid) return false;
    } catch {
      if (!/^[a-z0-9_]{3,30}$/.test(clean)) return false;
    }

    try {
      const usernameDoc = await getDoc(doc(db, "usernames", clean));
      if (!usernameDoc.exists()) {
        return true;
      }
      return usernameDoc.data()?.uid === user?.uid;
    } catch (error) {
      console.warn(`Could not verify username "${clean}":`, error);
      return false;
    }
  };

  const completeOnboarding = async ({
    username,
    displayName,
    bio = "",
  }: {
    username: string;
    displayName: string;
    bio?: string;
  }) => {
    if (!user) throw new Error("User must be signed in to complete onboarding");

    const cleanUsername = username.toLowerCase().trim();
    const isAvailable = await checkUsernameAvailable(cleanUsername);
    if (!isAvailable) {
      throw new Error(`Username @${cleanUsername} is already taken or invalid.`);
    }

    const now = new Date().toISOString();
    const newProfile: UserProfile = {
      id: user.uid,
      email: user.email || "",
      displayName: displayName.trim() || cleanUsername,
      username: cleanUsername,
      photoURL: user.photoURL || getInitialsAvatar(cleanUsername),
      bio: bio.trim(),
      createdAt: profile?.createdAt || now,
      updatedAt: now,
      preferences: profile?.preferences || DEFAULT_PREFERENCES,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "usernames", cleanUsername), {
        uid: user.uid,
        username: cleanUsername,
        createdAt: now,
      });
      batch.set(doc(db, "users", user.uid), newProfile);
      await batch.commit();

      const savedProfile = await getDoc(doc(db, "users", user.uid));
      if (!savedProfile.exists() || !savedProfile.data()?.username) {
        throw new Error("O perfil do onboarding não foi confirmado no Firebase.");
      }

      onboardingCompletedUidRef.current = user.uid;
      setProfile(savedProfile.data() as UserProfile);
      setNeedsOnboarding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user || !profile) throw new Error("No active profile to update");

    const updatedData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    if (data.username && data.username.toLowerCase() !== profile.username) {
      const newUsername = data.username.toLowerCase().trim();
      const isAvailable = await checkUsernameAvailable(newUsername);
      if (!isAvailable) {
        throw new Error(`Username @${newUsername} is unavailable.`);
      }

      try {
        await setDoc(doc(db, "usernames", newUsername), {
          uid: user.uid,
          username: newUsername,
          createdAt: new Date().toISOString(),
        });
        if (profile.username) {
          await deleteDoc(doc(db, "usernames", profile.username));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `usernames/${newUsername}`);
      }
    }

    try {
      await updateDoc(doc(db, "users", user.uid), updatedData);
      setProfile((prev) => (prev ? { ...prev, ...updatedData } : null));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const deleteUserAccount = async () => {
    if (!user) throw new Error("No user to delete");
    try {
      if (profile?.username) {
        await deleteDoc(doc(db, "usernames", profile.username));
      }
      await deleteDoc(doc(db, "users", user.uid));
      await user.delete();
      await firebaseSignOut(auth);
      setProfile(null);
      setNeedsOnboarding(false);
    } catch (error) {
      console.error("Failed to delete account:", error);
      throw error;
    }
  };

  const [isGitHubConnected, setIsGitHubConnected] = useState(false);

  useEffect(() => {
    if (user) {
      fetch("/api/projects/github-user", {
        headers: { Authorization: `Bearer ${user.getIdToken(true)}` }
      }).then(res => setIsGitHubConnected(res.ok)).catch(() => setIsGitHubConnected(false));
    } else {
      setIsGitHubConnected(false);
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        needsOnboarding,
        signInWithEmail,
        createAccount,
        resetPassword,
        connectGitHub,
        addEmailPassword,
        isGitHubConnected,
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
