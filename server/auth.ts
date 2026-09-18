import type { NextFunction, Request, Response } from "express";
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp(
      firebaseProjectId
        ? { credential: applicationDefault(), projectId: firebaseProjectId }
        : { credential: applicationDefault() }
    );

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
  } catch {
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
