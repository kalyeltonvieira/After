import crypto from "node:crypto";
interface GitHubSession {
  uid: string;
  token: string;
  expiresAt: number;
}

const sessions = new Map<string, GitHubSession>();
const states = new Map<string, { uid: string; expiresAt: number }>();
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const STATE_TTL = 10 * 60 * 1000;

export function createOAuthState(uid: string) {
  const state = crypto.randomBytes(32).toString("hex");
  states.set(state, { uid, expiresAt: Date.now() + STATE_TTL });
  return state;
}

export function consumeOAuthState(state: string) {
  const record = states.get(state);
  states.delete(state);
  if (!record || record.expiresAt < Date.now()) return null;
  return record;
}

export function createGitHubSession(uid: string, token: string) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  sessions.set(sessionId, { uid, token, expiresAt: Date.now() + SESSION_TTL });
  return sessionId;
}

export function getGitHubToken(sessionId: string | undefined, uid: string) {
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session || session.uid !== uid || session.expiresAt < Date.now()) {
    if (session?.expiresAt && session.expiresAt < Date.now()) sessions.delete(sessionId);
    return null;
  }
  return session.token;
}

export function revokeGitHubSession(sessionId: string | undefined) {
  if (sessionId) sessions.delete(sessionId);
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

export async function persistGitHubToken(_uid: string, _token: string) {
  // Firestore persistence is optional. The browser session cache is the
  // source of truth in AI Studio, where server IAM may not allow Firestore.
  return false;
}

export async function getPersistentGitHubToken(_uid: string) {
  return null;
}
