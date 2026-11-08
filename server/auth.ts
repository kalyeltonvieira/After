import type { NextFunction, Request, Response } from "express";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function resolveFirebaseProjectId(): string | undefined {
  // FIREBASE_PROJECT_ID is authoritative when explicitly configured.
  if (process.env.FIREBASE_PROJECT_ID?.trim()) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }

  // AI Studio/Cloud Run can expose GCLOUD_PROJECT for the hosting project,
  // which is not necessarily the Firebase project used by this app.
  // Fall back to the checked-in Firebase client config instead of binding
  // token verification to the hosting project's ID.
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const configPath = path.resolve(currentDir, "../firebase-applet-config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (typeof config.projectId === "string" && config.projectId.trim()) {
      return config.projectId.trim();
    }
  } catch (error) {
    console.warn("Could not read firebase-applet-config.json:", error);
  }

  // Keep Google-provided project identifiers only as a final fallback for
  // deployments that do not ship the client config file.
  return process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || undefined;
}

function resolveFirestoreDatabaseId(): string {
  if (process.env.FIRESTORE_DATABASE_ID?.trim()) {
    return process.env.FIRESTORE_DATABASE_ID.trim();
  }

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const configPath = path.resolve(currentDir, "../firebase-applet-config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (typeof config.firestoreDatabaseId === "string" && config.firestoreDatabaseId.trim()) {
      return config.firestoreDatabaseId.trim();
    }
  } catch (error) {
    console.warn("Could not read Firestore database ID from firebase-applet-config.json:", error);
  }

  return "(default)";
}

export const firebaseProjectId = resolveFirebaseProjectId();
export const firestoreDatabaseId = resolveFirestoreDatabaseId();

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp(
      firebaseProjectId
        ? { credential: applicationDefault(), projectId: firebaseProjectId }
        : { credential: applicationDefault() }
    );

export { adminApp };

export function getAdminFirestore() {
  return getFirestore(adminApp, firestoreDatabaseId);
}

import { getSession, readEncryptedGitHubTokenCookie } from "./githubSession.js";

export interface AuthenticatedRequest extends Request {
  user?: { uid: string; login?: string; email?: string; [key: string]: unknown };
  firebaseToken?: string;
  githubToken?: string;
}

export async function requireFirebaseUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // 1. Check for active GitHub session cookie
  const sessionId = req.cookies?.after_github_session;
  if (sessionId) {
    const session = getSession(sessionId);
    if (session) {
      req.user = { uid: session.uid, login: session.uid };
      req.githubToken = session.token;
      return next();
    }
  }

  // 2. Check for encrypted GitHub token cookie
  const tokenCookie = req.cookies?.after_github_token;
  if (tokenCookie) {
    const decrypted = readEncryptedGitHubTokenCookie(tokenCookie);
    if (decrypted) {
      req.user = { uid: "github-user" };
      req.githubToken = decrypted;
      return next();
    }
  }

  // 3. Check Authorization header
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) {
    const rawToken = match[1].trim().replace(/^["']|["']$/g, "");
    // If it's a GitHub token format or custom session
    if (rawToken.startsWith("gho_") || rawToken.startsWith("ghp_") || (rawToken.length >= 30 && !rawToken.includes("."))) {
      req.user = { uid: "github-user" };
      req.githubToken = rawToken;
      return next();
    }

    // Optional legacy Firebase verifyIdToken fallback
    if (rawToken.split(".").length === 3) {
      try {
        req.user = await getAuth(adminApp).verifyIdToken(rawToken);
        req.firebaseToken = rawToken;
        return next();
      } catch (error: any) {
        // Fall through
      }
    }
  }

  return res.status(401).json({ error: "Firebase authentication is required." });
}

export const requireAuth = requireFirebaseUser;

export function optionalFirebaseUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const sessionId = req.cookies?.after_github_session;
  if (sessionId) {
    const session = getSession(sessionId);
    if (session) {
      req.user = { uid: session.uid, login: session.uid };
      req.githubToken = session.token;
      return next();
    }
  }

  const tokenCookie = req.cookies?.after_github_token;
  if (tokenCookie) {
    const decrypted = readEncryptedGitHubTokenCookie(tokenCookie);
    if (decrypted) {
      req.user = { uid: "github-user" };
      req.githubToken = decrypted;
      return next();
    }
  }

  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return next();

  const token = match[1].trim();
  if (token.split(".").length === 3) {
    getAuth(adminApp)
      .verifyIdToken(token)
      .then((user) => {
        req.user = user;
        req.firebaseToken = token;
        next();
      })
      .catch(() => next());
  } else {
    next();
  }
}
