import assert from "node:assert/strict";
import test from "node:test";
import { requireFirebaseUser } from "../server/auth.js";
import { createGitHubBranch, deleteGitHubBranch } from "../server/services/githubMutations.js";

test("auth middleware rejects requests without a Firebase bearer token", async () => {
  const req = { headers: {} } as any;
  let status = 0;
  let payload: unknown;
  const res = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { payload = value; return this; },
  } as any;
  let called = false;

  await requireFirebaseUser(req, res, () => { called = true; });

  assert.equal(status, 401);
  assert.deepEqual(payload, { error: "Firebase authentication is required." });
  assert.equal(called, false);
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
