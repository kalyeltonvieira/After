import type { NextFunction, Request, Response } from "express";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function resolveFirebaseProjectId(): string | undefined {
  if (process.env.FIREBASE_PROJECT_ID?.trim()) return process.env.FIREBASE_PROJECT_ID.trim();
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const configPath = path.resolve(currentDir, "../firebase-applet-config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (typeof config.projectId === "string" && config.projectId.trim()) return config.projectId.trim();
  } catch {
    // Continue to deployment-provided identifiers.
  }
  return process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || undefined;
}

function resolveFirestoreDatabaseId(): string {
  if (process.env.FIRESTORE_DATABASE_ID?.trim()) return process.env.FIRESTORE_DATABASE_ID.trim();
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const configPath = path.resolve(currentDir, "../firebase-applet-config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (typeof config.firestoreDatabaseId === "string" && config.firestoreDatabaseId.trim()) return config.firestoreDatabaseId.trim();
  } catch {
    // Use the default database when no named database is configured.
  }
  return "(default)";
}

export const firebaseProjectId = resolveFirebaseProjectId();
export const firestoreDatabaseId = resolveFirestoreDatabaseId();

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseProjectId
      ? { credential: applicationDefault(), projectId: firebaseProjectId }
      : { credential: applicationDefault() });

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

function setGitHubIdentity(req: AuthenticatedRequest, uid: string, token: string) {
  req.user = { uid, login: uid };
  req.githubToken = token;
}

async function verifyGitHubToken(token: string): Promise<{ login: string } | null> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "AFTER-Software-Evolution-Platform",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const user = await response.json() as { login?: unknown };
    return typeof user.login === "string" && user.login ? { login: user.login } : null;
  } catch {
    return null;
  }
}

async function authenticateRequest(req: AuthenticatedRequest): Promise<boolean> {
  const sessionId = req.cookies?.after_github_session;
  if (sessionId) {
    const session = getSession(sessionId);
    if (session) {
      setGitHubIdentity(req, session.uid, session.token);
      return true;
    }
  }

  // Encrypted token cookies are not identities. Resolve the real GitHub user
  // before granting access, rather than mapping every cookie to "github-user".
  const cookieToken = readEncryptedGitHubTokenCookie(req.cookies?.after_github_token);
  if (cookieToken) {
    const githubUser = await verifyGitHubToken(cookieToken);
    if (githubUser) {
      setGitHubIdentity(req, githubUser.login, cookieToken);
      return true;
    }
  }

  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const token = match[1].trim().replace(/^['"]|['"]$/g, "");

  // GitHub tokens are accepted only after GitHub confirms the identity.
  if (token.startsWith("gho_") || token.startsWith("ghp_") || (token.length >= 30 && !token.includes("."))) {
    const githubUser = await verifyGitHubToken(token);
    if (!githubUser) return false;
    setGitHubIdentity(req, githubUser.login, token);
    return true;
  }

  return false;
}

export async function requireFirebaseUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (await authenticateRequest(req)) return next();
  return res.status(401).json({ error: "A valid authenticated session is required." });
}

export const requireAuth = requireFirebaseUser;

export function optionalFirebaseUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  void authenticateRequest(req).finally(() => next());
}
