import assert from "node:assert/strict";
import test from "node:test";
import { requireGitHubUser } from "../server/auth.js";
import { createGitHubBranch, deleteGitHubBranch } from "../server/services/githubMutations.js";
import { createEncryptedGitHubTokenCookie, readEncryptedGitHubTokenCookie, createOAuthState, consumeOAuthState } from "../server/githubSession.js";

test("auth middleware rejects requests without a valid GitHub session", async () => {
  const req = { headers: {}, cookies: {} } as any;
  let status = 0;
  let payload: unknown;
  const res = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { payload = value; return this; },
  } as any;
  let called = false;

  await requireGitHubUser(req, res, () => { called = true; });

  assert.equal(status, 401);
  assert.deepEqual(payload, { error: "A valid authenticated session is required." });
  assert.equal(called, false);
});

test("encrypted GitHub token cookie round-trips without exposing the token", () => {
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const token = "gho_example_secret_token";
  const cookie = createEncryptedGitHubTokenCookie(token);

  assert.notEqual(cookie, token);
  assert.equal(readEncryptedGitHubTokenCookie(cookie), token);
  assert.equal(readEncryptedGitHubTokenCookie("not-a-valid-cookie"), null);
});

test("branch creation propagates GitHub failures instead of fabricating success", async () => {
  const request = async () => {
    throw Object.assign(new Error("GitHub API error (403)"), { status: 403 });
  };

  await assert.rejects(
    () => createGitHubBranch(request, "owner", "repo", "feature/test", "main"),
    (error: any) => error.status === 403,
  );
});

test("branch creation uses the real base SHA and response", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const request = async (path: string, _token?: string, init?: RequestInit) => {
    calls.push({ path, init });
    if (path.includes("git/ref/heads")) return { body: { object: { sha: "abc123" } } };
    return { body: { ref: "refs/heads/feature/test", object: { sha: "def456" } } };
  };

  const result = await createGitHubBranch(request, "owner", "repo", "feature/test", "main");

  assert.deepEqual(result, { ref: "refs/heads/feature/test", object: { sha: "def456" } });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init?.method, "POST");
  assert.match(String(calls[1].init?.body), /abc123/);
});

test("branch deletion propagates GitHub failures", async () => {
  const request = async () => {
    throw Object.assign(new Error("GitHub API error (404)"), { status: 404 });
  };

  await assert.rejects(
    () => deleteGitHubBranch(request, "owner", "repo", "missing"),
    (error: any) => error.status === 404,
  );
});


test("token encryption fails closed when the encryption key is missing or invalid", () => {
  const original = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  try {
    delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
    assert.throws(() => createEncryptedGitHubTokenCookie("gho_secret"), /GITHUB_TOKEN_ENCRYPTION_KEY/);
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "not-a-hex-key";
    assert.throws(() => createEncryptedGitHubTokenCookie("gho_secret"), /GITHUB_TOKEN_ENCRYPTION_KEY/);
  } finally {
    if (original === undefined) delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
    else process.env.GITHUB_TOKEN_ENCRYPTION_KEY = original;
  }
});

test("OAuth state is consumed once and cannot be replayed", async () => {
  const state = await createOAuthState("test-user");
  const first = await consumeOAuthState(state);
  const second = await consumeOAuthState(state);

  assert.equal(first?.uid, "test-user");
  assert.equal(second, null);
});
