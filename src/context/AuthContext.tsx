import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  auth,
  db,
  googleProvider,
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
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Test Firestore connection on initial boot
  useEffect(() => {
    testConnection();
  }, []);

  // Listen to Auth state changes
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);

        // Subscribe to live updates for the user profile
        unsubscribeProfile = onSnapshot(
          userDocRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserProfile;
              setProfile(data);
              setNeedsOnboarding(!data.username);
            } else {
              setProfile(null);
              setNeedsOnboarding(true);
            }
            setLoading(false);
          },
          (error) => {
            handleFirestoreError(
              error,
              OperationType.GET,
              `users/${currentUser.uid}`
            );
            setLoading(false);
          }
        );
      } else {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setProfile(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  // Google Sign In via popup
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google sign in error:", error);
      throw error;
    }
  };

  // Email & Password Sign In
  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      console.error("Email sign in error:", error);
      throw error;
    }
  };

  // Sign Up with Email
  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (cred.user) {
        await firebaseUpdateProfile(cred.user, { displayName: name });
      }
    } catch (error: any) {
      console.error("Email sign up error:", error);
      throw error;
    }
  };

  // Send Password Reset
  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error("Password reset error:", error);
      throw error;
    }
  };

  // Sign Out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setProfile(null);
      setNeedsOnboarding(false);
    } catch (error: any) {
      console.error("Sign out error:", error);
      throw error;
    }
  };

  // Check username availability in Firestore /usernames/{username}
  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const clean = username.toLowerCase().trim();
    if (!clean || clean.length < 3) return false;

    // Validate with server route first
    try {
      const res = await fetch(`/api/projects/validate-username?username=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!data.valid) return false;
    } catch {
      // fallback to client validation
      if (!/^[a-z0-9_]{3,30}$/.test(clean)) return false;
    }

    try {
      const usernameDoc = await getDoc(doc(db, "usernames", clean));
      if (!usernameDoc.exists()) {
        return true;
      }
      // If document exists, check if it's currently owned by the logged-in user
      return usernameDoc.data()?.uid === user?.uid;
    } catch (error) {
      console.warn(`Could not verify username "${clean}":`, error);
      return false;
    }
  };

  // Complete onboarding for first time user
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
      createdAt: now,
      updatedAt: now,
      preferences: DEFAULT_PREFERENCES,
    };

    try {
      // 1. Reserve username
      await setDoc(doc(db, "usernames", cleanUsername), {
        uid: user.uid,
        username: cleanUsername,
        createdAt: now,
      });

      // 2. Write profile document
      await setDoc(doc(db, "users", user.uid), newProfile);
      setProfile(newProfile);
      setNeedsOnboarding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  // Update existing user profile
  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user || !profile) throw new Error("No active profile to update");

    const updatedData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    // If username is changing, handle the username reservation release and reassignment
    if (data.username && data.username.toLowerCase() !== profile.username) {
      const newUsername = data.username.toLowerCase().trim();
      const isAvailable = await checkUsernameAvailable(newUsername);
      if (!isAvailable) {
        throw new Error(`Username @${newUsername} is unavailable.`);
      }

      try {
        // Reserve new username
        await setDoc(doc(db, "usernames", newUsername), {
          uid: user.uid,
          username: newUsername,
          createdAt: new Date().toISOString(),
        });
        // Release old username
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

  // Delete account (Danger Zone)
  const deleteUserAccount = async () => {
    if (!user) throw new Error("No user to delete");
    try {
      if (profile?.username) {
        await deleteDoc(doc(db, "usernames", profile.username));
      }
      await deleteDoc(doc(db, "users", user.uid));
      await user.delete();
      await signOut();
    } catch (error) {
      console.error("Failed to delete account:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        needsOnboarding,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
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
