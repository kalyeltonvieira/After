import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  createGitHubSession,
  createOAuthState,
  consumeOAuthState,
  persistGitHubToken,
} from "../githubSession.js";
import { adminApp } from "../auth.js";
import { getAuthenticatedUser } from "../services/githubService.js";

const OAUTH_STATE_COOKIE = "after_github_oauth_state";
const GITHUB_SESSION_COOKIE = "after_github_session";

function appOrigin(req: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return new URL(configured).origin;
  return new URL(`${req.protocol}://${req.get("host")}`).origin;
}

function callbackUrl(req: Request) {
  return `${appOrigin(req)}/auth/github/callback`;
}

function buildAuthorizationUrl(req: Request, state: string) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("GitHub OAuth is not configured on the server.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(req),
    scope: "repo,read:user,user:email",
    state,
    allow_signup: "true",
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

async function getGitHubPrimaryEmail(token: string, fallback: string | null) {
  if (fallback) return fallback;

  const response = await fetch("https://api.github.com/user/emails", {
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "AFTER-Software-Evolution-Platform",
    },
  });

  if (!response.ok) return null;

  const emails = await response.json().catch(() => []);
  if (!Array.isArray(emails)) return null;

  const verifiedPrimary = emails.find(
    (item: any) => item?.primary === true && item?.verified === true && typeof item?.email === "string"
  );
  const verifiedAny = emails.find(
    (item: any) => item?.verified === true && typeof item?.email === "string"
  );

  return verifiedPrimary?.email || verifiedAny?.email || null;
}

async function ensureFirebaseIdentity(
  githubUser: Awaited<ReturnType<typeof getAuthenticatedUser>>,
  email: string | null
) {
  const firebaseAuth = getAuth(adminApp);
  let uid = `github_${githubUser.id}`;

  if (email) {
    try {
      const existing = await firebaseAuth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      // No existing Firebase account for this email. Use the stable GitHub ID below.
    }
  }

  const db = getFirestore(adminApp);
  const userRef = db.collection("users").doc(uid);
  const existingProfile = await userRef.get();
  const now = new Date().toISOString();

  if (!existingProfile.exists) {
    await userRef.set({
      id: uid,
      email: email || "",
      displayName: githubUser.name?.trim() || githubUser.login,
      username: "",
      photoURL: githubUser.avatar_url || "",
      bio: "",
      createdAt: now,
      updatedAt: now,
      preferences: {
        theme: "system",
        notifications: true,
        autoAnalysis: true,
        weeklySummary: true,
        experimentalFeatures: false,
      },
      authProvider: "github",
      githubId: githubUser.id,
      githubLogin: githubUser.login,
    });
  } else {
    await userRef.set(
      {
        email: email || existingProfile.data()?.email || "",
        displayName:
          githubUser.name?.trim() ||
          existingProfile.data()?.displayName ||
          githubUser.login,
        photoURL: githubUser.avatar_url || existingProfile.data()?.photoURL || "",
        updatedAt: now,
        authProvider: "github",
        githubId: githubUser.id,
        githubLogin: githubUser.login,
      },
      { merge: true }
    );
  }

  return uid;
}

export function githubLoginStart(req: Request, res: Response) {
  try {
    const state = createOAuthState("github-login");
    const authorizationUrl = buildAuthorizationUrl(req, state);

    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });

    return res.redirect(authorizationUrl);
  } catch (error: any) {
    return res.status(500).send(
      `GitHub login is unavailable: ${String(error?.message || "OAuth is not configured").replace(/[<>]/g, "")}`
    );
  }
}

export async function githubLoginCallback(req: Request, res: Response) {
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    return res.status(400).send("GitHub authorization was cancelled or invalid.");
  }

  const stateValue = String(state);
  const stateCookie = req.cookies?.[OAUTH_STATE_COOKIE];
  if (!stateCookie || stateCookie !== stateValue) {
    return res.status(400).send("GitHub authorization state is invalid.");
  }

  const stateRecord = consumeOAuthState(stateValue);
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

  if (!stateRecord || stateRecord.uid !== "github-login") {
    return res.status(400).send("GitHub authorization state expired.");
  }

  try {
    const { exchangeOAuthCode } = await import("../services/githubService.js");
    const result = await exchangeOAuthCode(String(code));
    const githubUser = await getAuthenticatedUser(result.token);
    const email = await getGitHubPrimaryEmail(result.token, githubUser.email);
    const uid = await ensureFirebaseIdentity(githubUser, email);

    const sessionId = createGitHubSession(uid, result.token);
    await persistGitHubToken(uid, result.token);

    res.cookie(GITHUB_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    const customToken = await getAuth(adminApp).createCustomToken(uid, {
      provider: "github",
      githubId: githubUser.id,
      githubLogin: githubUser.login,
    });

    const targetOrigin = appOrigin(req);

    return res.send(
      `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;padding:2rem">Completing GitHub login…</body>
<script>
window.opener?.postMessage(
  {type:"GITHUB_LOGIN_SUCCESS", firebaseToken:${JSON.stringify(customToken)}},
  ${JSON.stringify(targetOrigin)}
);
setTimeout(() => window.close(), 120);
</script>
</html>`
    );
  } catch (error: any) {
    return res.status(400).send(
      `GitHub login failed: ${String(error?.message || "Unknown error").replace(/[<>]/g, "")}`
    );
  }
}
