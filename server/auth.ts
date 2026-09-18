import type { NextFunction, Request, Response } from "express";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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

const firebaseProjectId = resolveFirebaseProjectId();
const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp(
      firebaseProjectId
        ? { credential: applicationDefault(), projectId: firebaseProjectId }
        : { credential: applicationDefault() }
    );

export { adminApp };

export interface AuthenticatedRequest extends Request {
  user?: { uid: string; email?: string; [key: string]: unknown };
}

export async function requireFirebaseUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Firebase authentication is required." });

  try {
    req.user = await getAuth(adminApp).verifyIdToken(match[1]);
    next();
  } catch (error: any) {
    console.error("Firebase ID token verification failed:", {
      code: error?.code || "unknown",
      message: error?.message || "unknown error",
      projectId: adminApp.options.projectId || firebaseProjectId || "unknown",
    });
    return res.status(401).json({ error: "Invalid or expired Firebase session." });
  }
}

export function optionalFirebaseUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return next();
  getAuth(adminApp)
    .verifyIdToken(match[1])
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(() => next());
}
