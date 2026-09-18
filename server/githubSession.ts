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
