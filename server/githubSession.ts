import crypto from "node:crypto";
import { getAdminFirestore } from "./auth.js";
interface GitHubSession {
  uid: string;
  token: string;
  expiresAt: number;
}

const sessions = new Map<string, GitHubSession>();
const userSessions = new Map<string, { token: string; expiresAt: number }>();
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const STATE_TTL = 10 * 60 * 1000;

export function createOAuthState(uid: string) {
  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (!secret) throw new Error("GITHUB_CLIENT_SECRET is not configured.");
  const payload = Buffer.from(JSON.stringify({
    uid,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(24).toString("hex"),
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function consumeOAuthState(state: string): { uid: string; expiresAt: number } | null {
  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (!secret || typeof state !== "string") return null;
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra) return null;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const issuedAt = Number(decoded?.issuedAt);
    if (typeof decoded?.uid !== "string" || !decoded.uid || !Number.isFinite(issuedAt)) return null;
    const expiresAt = issuedAt + STATE_TTL;
    if (issuedAt > Date.now() + 30_000 || expiresAt < Date.now()) return null;
    return { uid: decoded.uid, expiresAt };
  } catch {
    return null;
  }
}

export function createGitHubSession(uid: string, token: string) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL;
  sessions.set(sessionId, { uid, token, expiresAt });
  userSessions.set(uid, { token, expiresAt });
  return sessionId;
}

export function getGitHubToken(sessionId: string | undefined, uid: string) {
  // 1. Try session ID cookie
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (session && session.uid === uid && session.expiresAt > Date.now()) {
      return session.token;
    }
    if (session?.expiresAt && session.expiresAt <= Date.now()) {
      sessions.delete(sessionId);
    }
  }

  // 2. Fallback to memory map for iframe environments where third-party cookies are partitioned
  const userSession = userSessions.get(uid);
  if (userSession && userSession.expiresAt > Date.now()) {
    return userSession.token;
  }
  if (userSession?.expiresAt && userSession.expiresAt <= Date.now()) {
    userSessions.delete(uid);
  }

  return null;
}

export async function revokeGitHubSession(sessionId: string | undefined, uid?: string) {
  if (sessionId) sessions.delete(sessionId);
  if (uid) userSessions.delete(uid);
  if (uid) {
    try {
      await getAdminFirestore().collection("githubTokenVault").doc(uid).delete();
    } catch (error: any) {
      // A missing user document should not prevent local session revocation.
      if (error?.code !== 5) {
        console.warn(
          "Could not remove persisted GitHub token:",
          error?.code === 7
            ? "Firestore Admin lacks IAM permission for the configured database; encrypted cookie fallback remains active."
            : error?.message || error
        );
      }
    }
  }
}


function encryptionKey(): Buffer {
  const raw = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters.");
  }
  return Buffer.from(raw, "hex");
}

function encryptToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptToken(data: any): string | null {
  try {
    if (!data?.ciphertext || !data?.iv || !data?.tag) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(data.iv, "base64"));
    decipher.setAuthTag(Buffer.from(data.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function createEncryptedGitHubTokenCookie(token: string): string {
  return Buffer.from(JSON.stringify(encryptToken(token.trim())), "utf8").toString("base64url");
}

export function readEncryptedGitHubTokenCookie(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    return decryptToken(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export async function persistGitHubToken(uid: string, token: string) {
  if (!uid || !token.trim()) return false;

  try {
    const encrypted = encryptToken(token.trim());
    await getAdminFirestore().collection("githubTokenVault").doc(uid).set({
      accessToken: encrypted,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error: any) {
    console.warn(
      "Could not persist GitHub token:",
      error?.code === 7
        ? "Firestore Admin lacks IAM permission for the configured database; encrypted cookie fallback remains active."
        : error?.message || error
    );
    return false;
  }
}

export async function getPersistentGitHubToken(uid: string) {
  if (!uid) return null;

  try {
    const snapshot = await getAdminFirestore().collection("githubTokenVault").doc(uid).get();
    return decryptToken(snapshot.data()?.accessToken);
  } catch (error: any) {
    console.warn("Could not restore GitHub token:", error?.message || error);
    return null;
  }
}
