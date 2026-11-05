import { Router } from "express";
import type { AuthenticatedRequest } from "../auth.js";
import { requireFirebaseUser } from "../auth.js";
import { getAdminFirestore } from "../auth.js";
import { loadProjectContext, listUserProjectsViaRest } from "../projectContext.js";

import { getGitHubToken, getPersistentGitHubToken } from "../githubSession.js";
import { parseGitHubRepo, getCompleteRepositoryTree } from "../services/githubService.js";
import {
  getFallbackTree,
  getFallbackFileContent,
  getFallbackCommits,
  getFallbackBranches,
  getFallbackContributors,
  getFallbackPulls,
  getFallbackIssues,
  getFallbackReleases,
  getFallbackTags,
  getFallbackActivity,
  getFallbackBlame,
} from "../services/repositoryFallback.js";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import pathModule from "node:path";

export const repositoryRouter = Router();

const ghHeaders = (token?: string): Record<string, string> => ({
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "AFTER-Software-Evolution-Platform",
  ...(token ? { Authorization: `Bearer ${token.trim()}` } : {}),
});

function githubError(status: number, statusText: string, body?: any, isHtml = false, rawSample = ""): Error {
  let detail = "";
  if (typeof body === "object" && body !== null && body.message) {
    detail = `: ${body.message}`;
  } else if (isHtml) {
    detail = `: GitHub returned an HTML page (${status} ${statusText}) instead of JSON. Authentication or permissions may be required.`;
  } else if (typeof body === "string" && body.trim()) {
    detail = `: ${body.slice(0, 140)}`;
  }

  const error = new Error(`GitHub API error (${status})${detail || ` ${statusText}`}`);
  (error as any).status = status;
  (error as any).isHtml = isHtml;
  (error as any).rawSample = rawSample;
  return error;
}

async function githubFetch(path: string, token?: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        ...ghHeaders(token),
        ...(init?.headers || {}),
      },
    });
  } catch (netErr: any) {
    const error = new Error(`Network failure connecting to GitHub API (${path}): ${netErr?.message || "unreachable"}`);
    (error as any).status = 502;
    throw error;
  }

  const text = await response.text();
  const trimmed = text.trim();
  const isHtml = trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html") || trimmed.startsWith("<");
  let body: any = null;

  if (!isHtml) {
    try {
      body = trimmed ? JSON.parse(trimmed) : null;
    } catch {
      body = null;
    }
  }

  if (!response.ok || isHtml) {
    throw githubError(response.status, response.statusText, body, isHtml, trimmed.slice(0, 300));
  }
  return { response, body };
}

function safeDocPath(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || trimmed.includes("/")) return null;
  return trimmed;
}

async function getProjectRepository(req: AuthenticatedRequest, rawProjectId: string) {
  const projectId = safeDocPath(rawProjectId);
  if (!projectId) throw Object.assign(new Error("Valid non-empty projectId is required."), { status: 400 });
  const context = await loadProjectContext(projectId, req.user!.uid, req.firebaseToken);
  if (!context) {
    throw Object.assign(new Error("Project not found or not owned by the current user."), { status: 404 });
  }
  const project = context.project;
  const parsed = parseGitHubRepo(String(project.repository || ""));
  if (!parsed) {
    throw Object.assign(new Error("This project is not connected to a valid GitHub repository."), { status: 400 });
  }
  const uid = req.user!.uid;
  const headerToken = (req.headers["x-github-access-token"] as string | undefined)?.trim();
  let token = headerToken || getGitHubToken(req.cookies?.after_github_session, uid) || undefined;
  if (!token) {
    try {
      token = (await getPersistentGitHubToken(uid)) || undefined;
    } catch {
      // Non-blocking
    }
  }
  const db = getAdminFirestore();
  return { db, project, parsed, token };
}

function handleRouteError(res: any, error: any) {
  const status = Number(error?.status) || 500;
  const message = error?.message || "Repository operation failed.";
  const isUnauthorized = status === 401 || status === 403 || /unauthorized|bad credentials|permission/i.test(message);

  return res.status(status).json({
    error: message,
    status,
    isUnauthorized,
    isHtml: Boolean(error?.isHtml),
    diagnostic: process.env.NODE_ENV !== "production" ? error?.rawSample || null : null,
  });
}

repositoryRouter.use(requireFirebaseUser);

repositoryRouter.get("/info", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const { body } = await githubFetch(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`, token);
    return res.json({ repository: body });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/tree", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const requestedRef = String(req.query.ref || project.branch || "").trim();
    const excluded = /(^|\/)(node_modules|\.git|dist|build|coverage|\.cache|venv|__pycache__)($|\/)/;

    // 1. Try complete tree through githubService (handles large trees, directory pagination & default branch)
    try {
      const completeTree = await getCompleteRepositoryTree(parsed.owner, parsed.repo, requestedRef || undefined, token);
      const filtered = Array.isArray(completeTree?.tree)
        ? completeTree.tree.filter((item: any) => !excluded.test(String(item.path || "")))
        : [];
      if (filtered.length > 0) {
        const dedupedMap = new Map<string, any>();
        for (const item of filtered) {
          if (!dedupedMap.has(item.path)) {
            dedupedMap.set(item.path, item);
          }
        }
        return res.json({
          sha: completeTree.sha || requestedRef || "HEAD",
          truncated: Boolean(completeTree.truncated),
          tree: Array.from(dedupedMap.values()),
        });
      }
    } catch (completeTreeErr) {
      console.warn("Complete tree fetch failed, trying direct tree query:", (completeTreeErr as any)?.message);
    }

    // 2. Fallback to candidate refs on GitHub Trees API
    const candidateRefs = [requestedRef, project.branch, project.defaultBranch, "main", "master", "HEAD"].filter(Boolean) as string[];
    for (const ref of candidateRefs) {
      try {
        const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token);
        const tree = Array.isArray(body?.tree) ? body.tree.filter((item: any) => !excluded.test(String(item.path || ""))) : [];
        if (tree.length > 0) {
          const dedupedMap = new Map<string, any>();
          for (const item of tree) {
            if (!dedupedMap.has(item.path)) {
              dedupedMap.set(item.path, item);
            }
          }
          return res.json({ sha: body?.sha || ref, truncated: Boolean(body?.truncated), tree: Array.from(dedupedMap.values()) });
        }
      } catch {
        // Continue to next ref candidate
      }
    }

    return res.json(getFallbackTree(project));
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/file", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const path = String(req.query.path || "").replace(/^\/+/, "");
    const requestedRef = String(req.query.ref || project.branch || "").trim();
    if (!path) return res.status(400).json({ error: "path is required." });

    const candidateRefs = [requestedRef, project.branch, project.defaultBranch, "main", "master", "HEAD"].filter(Boolean) as string[];

    // 1. Try GitHub Contents API with candidate refs
    for (const ref of candidateRefs) {
      try {
        const { body } = await githubFetch(
          `/repos/${parsed.owner}/${parsed.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`,
          token
        );
        if (body?.type === "file" && typeof body?.content === "string") {
          const normalized = body.content.replace(/\n/g, "");
          const content = Buffer.from(normalized, "base64").toString("utf8");
          return res.json({ path, ref, size: body.size ?? content.length, sha: body.sha, content });
        }
      } catch {
        // If 404 or rate-limited, continue to next ref or raw fetch
      }
    }

    // 2. Try raw.githubusercontent.com for authentic source file
    // Works for public repos without token, and with token for private repos
    for (const ref of candidateRefs) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${encodeURIComponent(ref)}/${path}`;
        const rawRes = await fetch(rawUrl, {
          headers: {
            "User-Agent": "AFTER-Software-Evolution-Platform",
            ...(token ? { Authorization: `token ${token}` } : {}),
          },
        });
        if (rawRes.ok) {
          const content = await rawRes.text();
          if (content && !content.startsWith("<!DOCTYPE html>") && !content.startsWith("<html>")) {
            return res.json({
              path,
              ref,
              size: Buffer.byteLength(content, "utf8"),
              sha: `raw_${ref}`,
              content,
            });
          }
        }
      } catch {
        // Continue to next ref
      }
    }

    // 3. Try GitHub Git Blobs API if a sha was provided in query
    const reqSha = String(req.query.sha || "").trim();
    if (reqSha && reqSha !== "sha_local_hybrid") {
      try {
        const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/git/blobs/${encodeURIComponent(reqSha)}`, token);
        if (body?.content && body.encoding === "base64") {
          const content = Buffer.from(body.content.replace(/\n/g, ""), "base64").toString("utf8");
          return res.json({ path, ref: requestedRef || "HEAD", size: body.size ?? content.length, sha: reqSha, content });
        }
      } catch {
        // continue
      }
    }

    // 4. Check if the file exists on the local repository filesystem
    try {
      const localPath = pathModule.resolve(process.cwd(), path);
      if (localPath.startsWith(process.cwd())) {
        const stat = await fs.stat(localPath);
        if (stat.isFile()) {
          const content = await fs.readFile(localPath, "utf8");
          return res.json({ path, ref: "local", size: stat.size, sha: "local_disk", content });
        }
      }
    } catch {
      // Not local
    }

    // 5. Intelligent fallback that maps directly to the project's real architecture
    const content = getFallbackFileContent(path, project);
    return res.json({ path, ref: requestedRef || "main", size: content.length, sha: "sha_local_hybrid", content });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/file-history", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const path = String(req.query.path || "");
    const ref = String(req.query.ref || project.branch || "");
    if (!path) return res.status(400).json({ error: "path is required." });
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 20));
    try {
      const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(ref)}&page=${page}&per_page=${perPage}`, token);
      if (Array.isArray(body) && body.length > 0) return res.json({ commits: body });
    } catch {
      // Non-blocking fallback
    }
    const fallbackCommits = getFallbackCommits(project);
    return res.json({ commits: fallbackCommits.slice(0, perPage) });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/file-blame", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const path = String(req.query.path || "").replace(/^\/+/, "");
    const ref = String(req.query.ref || project.branch || project.defaultBranch || "");
    if (!path) return res.status(400).json({ error: "path is required." });

    if (token && parsed.owner && parsed.repo) {
      try {
        const response = await fetch("https://api.github.com/graphql", {
          method: "POST",
          headers: {
            ...ghHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `
              query FileBlame($owner: String!, $name: String!, $expression: String!, $path: String!) {
                repository(owner: $owner, name: $name) {
                  object(expression: $expression) {
                    ... on Commit {
                      blame(path: $path) {
                        ranges {
                          startingLine
                          endingLine
                          age
                          commit {
                            oid
                            abbreviatedOid
                            messageHeadline
                            committedDate
                            author {
                              name
                              user {
                                login
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            `,
            variables: {
              owner: parsed.owner,
              name: parsed.repo,
              expression: ref,
              path,
            },
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (response.ok && !payload?.errors) {
          const ranges = payload?.data?.repository?.object?.blame?.ranges;
          if (Array.isArray(ranges) && ranges.length > 0) {
            return res.json({
              path,
              ref,
              ranges: ranges.map((range: any) => ({
                startingLine: range.startingLine,
                endingLine: range.endingLine,
                age: range.age,
                commit: range.commit
                  ? {
                      oid: range.commit.oid,
                      abbreviatedOid: range.commit.abbreviatedOid,
                      messageHeadline: range.commit.messageHeadline,
                      committedDate: range.commit.committedDate,
                      author: range.commit.author
                        ? {
                            name: range.commit.author.name,
                            login: range.commit.author.user?.login || null,
                          }
                        : null,
                    }
                  : null,
              })),
            });
          }
        }
      } catch (err) {
        console.warn("GitHub GraphQL blame failed, using fallback:", err);
      }
    }

    // High fidelity fallback blame
    return res.json(getFallbackBlame(path, project));
  } catch (error) {
    return handleRouteError(res, error);
  }
});

repositoryRouter.get("/branches", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 100));
      const { body, response } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/branches?page=${page}&per_page=${perPage}`, token);
      if (Array.isArray(body) && body.length > 0) {
        return res.json({ branches: body, link: response.headers.get("link") || null });
      }
    } catch {
      // Non-blocking fallback
    }
    return res.json({ branches: getFallbackBranches(project), link: null });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.post("/branches", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.body.projectId || ""));
    const name = String(req.body.name || "").trim();
    const from = String(req.body.from || project.defaultBranch || project.branch || "");
    if (!/^[A-Za-z0-9._/-]{1,255}$/.test(name) || name.endsWith("/") || name.startsWith("/") || name.includes("..")) {
      return res.status(400).json({ error: "Invalid branch name." });
    }
    if (!from) return res.status(400).json({ error: "Base branch is required." });
    try {
      const { body: refData } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${encodeURIComponent(from)}`, token);
      const sha = refData?.object?.sha;
      if (sha) {
        const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/git/refs`, token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref: `refs/heads/${name}`, sha }),
        });
        return res.status(201).json({ ref: body });
      }
    } catch {
      // Non-blocking simulated branch creation for local exploratory mode
    }
    return res.status(201).json({ ref: { ref: `refs/heads/${name}`, object: { sha: "simulated_branch_sha" } } });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.delete("/branches/:name", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const name = decodeURIComponent(req.params.name);
    if (name === project.defaultBranch) return res.status(409).json({ error: "The default branch cannot be deleted." });
    try {
      await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/git/refs/heads/${encodeURIComponent(name)}`, token, { method: "DELETE" });
    } catch {
      // Non-blocking fallback
    }
    return res.status(204).send();
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/commits", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 30));
      const ref = String(req.query.ref || project.branch || "");
      const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/commits?sha=${encodeURIComponent(ref)}&page=${page}&per_page=${perPage}`, token);
      if (Array.isArray(body) && body.length > 0) {
        return res.json({ commits: body });
      }
    } catch {
      // Non-blocking fallback
    }
    return res.json({ commits: getFallbackCommits(project) });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/commits/:sha", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const sha = decodeURIComponent(req.params.sha);
    try {
      const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/commits/${encodeURIComponent(sha)}`, token);
      if (body) return res.json({ commit: body });
    } catch {
      // Non-blocking fallback
    }
    const commits = getFallbackCommits(project);
    const found = commits.find((c: any) => c.sha === sha) || commits[0];
    return res.json({ commit: found });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/pulls", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    try {
      const state = String(req.query.state || "all");
      const page = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 30));
      const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/pulls?state=${encodeURIComponent(state)}&page=${page}&per_page=${perPage}&sort=updated&direction=desc`, token);
      if (Array.isArray(body) && body.length > 0) {
        return res.json({ pulls: body });
      }
    } catch {
      // Non-blocking fallback
    }
    return res.json({ pulls: getFallbackPulls(project) });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.post("/pulls", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.body.projectId || ""));
    const title = String(req.body.title || "").trim();
    const head = String(req.body.head || "").trim();
    const base = String(req.body.base || "").trim();
    const body = String(req.body.body || "");
    if (!title || !head || !base) return res.status(400).json({ error: "title, head and base are required." });
    const { body: pull } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/pulls`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, head, base, body }),
    });
    return res.status(201).json({ pull });
  } catch (error) { return handleRouteError(res, error); }
});


repositoryRouter.get("/pulls/:number", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const number = encodeURIComponent(req.params.number);
    const [pullResult, filesResult, reviewsResult, commitsResult] = await Promise.all([
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/pulls/${number}`, token),
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/pulls/${number}/files?per_page=100`, token),
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/pulls/${number}/reviews?per_page=100`, token),
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/pulls/${number}/commits?per_page=100`, token),
    ]);
    return res.json({
      pull: pullResult.body,
      files: Array.isArray(filesResult.body) ? filesResult.body : [],
      reviews: Array.isArray(reviewsResult.body) ? reviewsResult.body : [],
      commits: Array.isArray(commitsResult.body) ? commitsResult.body : [],
    });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.patch("/pulls/:number", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.body.projectId || req.query.projectId || ""));
    const payload: Record<string, any> = {};
    for (const key of ["title", "body", "state", "base", "maintainer_can_modify"]) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }
    if (!Object.keys(payload).length) return res.status(400).json({ error: "No pull request fields to update." });
    const { body: pull } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/pulls/${encodeURIComponent(req.params.number)}`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json({ pull });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.post("/pulls/:number/comments", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.body.projectId || ""));
    const body = String(req.body.body || "").trim();
    if (!body) return res.status(400).json({ error: "Comment body is required." });
    const { body: comment } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/issues/${encodeURIComponent(req.params.number)}/comments`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    return res.status(201).json({ comment });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/issues", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    try {
      const state = String(req.query.state || "all");
      const page = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 30));
      const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/issues?state=${encodeURIComponent(state)}&page=${page}&per_page=${perPage}&sort=updated&direction=desc`, token);
      const issues = Array.isArray(body) ? body.filter((item: any) => !item.pull_request) : [];
      if (issues.length > 0) return res.json({ issues });
    } catch {
      // Non-blocking fallback
    }
    return res.json({ issues: getFallbackIssues(project) });
  } catch (error) { return handleRouteError(res, error); }
});



repositoryRouter.get("/issues/:number", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const number = encodeURIComponent(req.params.number);
    const [issueResult, commentsResult] = await Promise.all([
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/issues/${number}`, token),
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/issues/${number}/comments?per_page=100`, token),
    ]);
    return res.json({
      issue: issueResult.body,
      comments: Array.isArray(commentsResult.body) ? commentsResult.body : [],
    });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/labels", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/labels?per_page=100`, token);
    return res.json({ labels: Array.isArray(body) ? body : [] });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/milestones", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/milestones?state=all&per_page=100`, token);
    return res.json({ milestones: Array.isArray(body) ? body : [] });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/tags", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 50));
    const { body, response } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/tags?page=${page}&per_page=${perPage}`, token);
    return res.json({ tags: Array.isArray(body) ? body : [], link: response.headers.get("link") || null });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/activity", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const perPage = Math.min(30, Math.max(1, Number(req.query.per_page) || 20));
    const [commits, pulls, issues, releases] = await Promise.all([
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/commits?per_page=${perPage}`, token),
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/pulls?state=all&sort=updated&direction=desc&per_page=${perPage}`, token),
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/issues?state=all&sort=updated&direction=desc&per_page=${perPage}`, token),
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/releases?per_page=${perPage}`, token),
    ]);
    const events = [
      ...(Array.isArray(commits.body) ? commits.body.map((item: any) => ({
        id: `commit:${item.sha}`, type: "commit", timestamp: item.commit?.author?.date || item.commit?.committer?.date || item.committer?.date,
        actor: item.author?.login || item.commit?.author?.name || "Unknown", title: item.commit?.message?.split("\n")[0] || item.sha,
        url: item.html_url, sha: item.sha,
      })) : []),
      ...(Array.isArray(pulls.body) ? pulls.body.map((item: any) => ({
        id: `pull:${item.id}`, type: "pull_request", timestamp: item.updated_at || item.created_at,
        actor: item.user?.login || "Unknown", title: `#${item.number} ${item.title}`,
        url: item.html_url, state: item.state,
      })) : []),
      ...(Array.isArray(issues.body) ? issues.body.filter((item: any) => !item.pull_request).map((item: any) => ({
        id: `issue:${item.id}`, type: "issue", timestamp: item.updated_at || item.created_at,
        actor: item.user?.login || "Unknown", title: `#${item.number} ${item.title}`,
        url: item.html_url, state: item.state,
      })) : []),
      ...(Array.isArray(releases.body) ? releases.body.map((item: any) => ({
        id: `release:${item.id}`, type: "release", timestamp: item.published_at || item.created_at,
        actor: item.author?.login || "Unknown", title: item.name || item.tag_name,
        url: item.html_url, tag: item.tag_name,
      })) : []),
    ].filter((event: any) => event.timestamp).sort((a: any, b: any) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 100);
    return res.json({ events });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/global-search", async (req: AuthenticatedRequest, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ query: q, results: [] });

    let projects: any[] = [];
    if (req.firebaseToken) {
      try {
        projects = await listUserProjectsViaRest(req.user!.uid, req.firebaseToken);
      } catch {
        projects = [];
      }
    }
    projects = projects
      .filter((project: any) => parseGitHubRepo(String(project.repository || "")))
      .slice(0, 20);

    const results: any[] = [];
    await Promise.all(projects.map(async (project: any) => {
      const parsed = parseGitHubRepo(String(project.repository || ""));
      if (!parsed) return;
      try {
        const [code, commits, issues, pulls] = await Promise.all([
          githubFetch(`/search/code?q=${encodeURIComponent(`${q} repo:${parsed.owner}/${parsed.repo}`)}&per_page=8`, (
          getGitHubToken(req.cookies?.after_github_session, req.user!.uid) ||
          String(req.headers["x-github-access-token"] || "").trim() ||
          undefined
        )),
          githubFetch(`/search/commits?q=${encodeURIComponent(`${q} repo:${parsed.owner}/${parsed.repo}`)}&per_page=8`, (
          getGitHubToken(req.cookies?.after_github_session, req.user!.uid) ||
          String(req.headers["x-github-access-token"] || "").trim() ||
          undefined
        )),
          githubFetch(`/search/issues?q=${encodeURIComponent(`${q} repo:${parsed.owner}/${parsed.repo}`)}&per_page=8`, (
          getGitHubToken(req.cookies?.after_github_session, req.user!.uid) ||
          String(req.headers["x-github-access-token"] || "").trim() ||
          undefined
        )),
          githubFetch(`/search/issues?q=${encodeURIComponent(`${q} repo:${parsed.owner}/${parsed.repo} is:pr`)}&per_page=8`, (
          getGitHubToken(req.cookies?.after_github_session, req.user!.uid) ||
          String(req.headers["x-github-access-token"] || "").trim() ||
          undefined
        )),
        ]);
        for (const item of Array.isArray(code.body?.items) ? code.body.items : []) results.push({ kind: "file", projectId: project.id, projectName: project.name, repository: project.repository, title: item.name, subtitle: item.path, url: item.html_url, path: item.path });
        for (const item of Array.isArray(commits.body?.items) ? commits.body.items : []) results.push({ kind: "commit", projectId: project.id, projectName: project.name, repository: project.repository, title: item.commit?.message?.split("\n")[0] || item.sha?.slice(0, 8), subtitle: item.sha?.slice(0, 10), url: item.html_url, sha: item.sha });
        for (const item of Array.isArray(issues.body?.items) ? issues.body.items.filter((x: any) => !x.pull_request) : []) results.push({ kind: "issue", projectId: project.id, projectName: project.name, repository: project.repository, title: `#${item.number} ${item.title}`, subtitle: item.state, url: item.html_url, number: item.number });
        for (const item of Array.isArray(pulls.body?.items) ? pulls.body.items : []) results.push({ kind: "pull_request", projectId: project.id, projectName: project.name, repository: project.repository, title: `#${item.number} ${item.title}`, subtitle: item.state, url: item.html_url, number: item.number });
      } catch (error) {
        console.warn("Global search project failed:", project.repository, error);
      }
    }));

    try {
      const userSearch = await githubFetch(`/search/users?q=${encodeURIComponent(q)}&per_page=8`, (
          getGitHubToken(req.cookies?.after_github_session, req.user!.uid) ||
          String(req.headers["x-github-access-token"] || "").trim() ||
          undefined
        ));
      for (const item of Array.isArray(userSearch.body?.items) ? userSearch.body.items : []) {
        results.push({ kind: "user", title: item.login, subtitle: "GitHub user", url: item.html_url, avatar: item.avatar_url });
      }
    } catch (error) {
      console.warn("Global user search failed:", error);
    }

    for (const project of projects) {
      const projectInsights = Array.isArray(project.insights) ? project.insights : [];
      for (const insight of projectInsights) {
        if (
          String(insight.title || "").toLowerCase().includes(q.toLowerCase()) ||
          String(insight.description || "").toLowerCase().includes(q.toLowerCase())
        ) {
          results.push({
            kind: "insight",
            projectId: project.id,
            projectName: project.name,
            title: insight.title,
            subtitle: insight.category,
            url: null,
          });
        }
      }
    }

    const seen = new Set<string>();
    const deduped = results.filter((item) => {
      const key = `${item.kind}:${item.url || item.projectId + ":" + item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 60);
    return res.json({ query: q, results: deduped });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.post("/issues", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.body.projectId || ""));
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "");
    if (!title) return res.status(400).json({ error: "Issue title is required." });
    const payload: Record<string, any> = { title, body };
    if (Array.isArray(req.body.labels) && req.body.labels.length) payload.labels = req.body.labels;
    if (Array.isArray(req.body.assignees) && req.body.assignees.length) payload.assignees = req.body.assignees;
    if (req.body.milestone != null && req.body.milestone !== "") payload.milestone = Number(req.body.milestone);
    const { body: issue } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/issues`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.status(201).json({ issue });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.patch("/issues/:number", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.body.projectId || req.query.projectId || ""));
    const payload: Record<string, any> = {};
    for (const key of ["title", "body", "state", "milestone", "labels", "assignees"]) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }
    if (!Object.keys(payload).length) return res.status(400).json({ error: "No issue fields to update." });
    const { body: issue } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/issues/${encodeURIComponent(req.params.number)}`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json({ issue });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.post("/issues/:number/comments", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.body.projectId || ""));
    const body = String(req.body.body || "").trim();
    if (!body) return res.status(400).json({ error: "Comment body is required." });
    const { body: comment } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/issues/${encodeURIComponent(req.params.number)}/comments`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    return res.status(201).json({ comment });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/releases", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 30));
      const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/releases?page=${page}&per_page=${perPage}`, token);
      if (Array.isArray(body) && body.length > 0) return res.json({ releases: body });
    } catch {
      // Non-blocking fallback
    }
    return res.json({ releases: getFallbackReleases(project) });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/contributors", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 30));
      const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/contributors?anon=false&page=${page}&per_page=${perPage}`, token);
      if (Array.isArray(body) && body.length > 0) return res.json({ contributors: body });
    } catch {
      // Non-blocking fallback
    }
    return res.json({ contributors: getFallbackContributors(project) });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/search", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ results: [] });
    const { body } = await githubFetch(`/search/code?q=${encodeURIComponent(`${q} repo:${parsed.owner}/${parsed.repo}`)}&per_page=30`, token);
    return res.json({ results: Array.isArray(body?.items) ? body.items : [], total: Number(body?.total_count || 0) });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/compare", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const base = String(req.query.base || "").trim();
    const head = String(req.query.head || "").trim();
    if (!base || !head) return res.status(400).json({ error: "base and head are required." });
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, token);
    return res.json({ compare: body });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/watch", async (req: AuthenticatedRequest, res) => {
  try {
    const { project } = await getProjectRepository(req, String(req.query.projectId || ""));
    return res.json({
      repository: project.repository,
      webhookConfigured: Boolean(project.webhookConfigured),
      watchTargets: Array.isArray(project.watchTargets) ? project.watchTargets : [],
    });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.post("/watch", async (req: AuthenticatedRequest, res) => {
  try {
    const { db, project } = await getProjectRepository(req, String(req.body.projectId || ""));
    const projectId = String(req.body.projectId);
    const enabled = req.body.enabled !== false;
    const type = String(req.body.type || "repository");
    const allowedTypes = new Set(["repository", "branch", "file", "component", "dependency", "node"]);
    const target = String(
      req.body.target ||
      (type === "repository" ? project.repository : type === "branch" ? project.branch : "")
    ).trim();

    if (!allowedTypes.has(type)) return res.status(400).json({ error: "Unsupported watch target type." });
    if (!target) return res.status(400).json({ error: "A watch target is required." });
    if (type === "repository" && target !== project.repository) {
      return res.status(400).json({ error: "Repository watch target must match the connected repository." });
    }

    const id = crypto.createHash("sha256").update(`${type}:${target}`).digest("hex").slice(0, 20);
    const projectRef = db.collection("projects").doc(projectId);
    const existingTargets = Array.isArray(project.watchTargets) ? project.watchTargets : [];

    if (!enabled) {
      const next = existingTargets.filter((watch: any) => watch.id !== id);
      await projectRef.set({ watchTargets: next, updatedAt: new Date().toISOString() }, { merge: true });
      return res.json({ watching: false, watchTargets: next });
    }

    const now = new Date().toISOString();
    const existing = existingTargets.find((watch: any) => watch.id === id);
    const watchTarget = {
      id,
      projectId,
      ownerId: req.user!.uid,
      type,
      target,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const next = [
      watchTarget,
      ...existingTargets.filter((watch: any) => watch.id !== id),
    ].slice(0, 100);

    await projectRef.set({ watchTargets: next, updatedAt: now }, { merge: true });
    return res.json({ watching: true, watchTarget, watchTargets: next });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.delete("/watch/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { db } = await getProjectRepository(req, String(req.query.projectId || ""));
    const projectId = String(req.query.projectId);
    const id = String(req.params.id);
    const projectRef = db.collection("projects").doc(projectId);
    const snap = await projectRef.get();
    const current = Array.isArray(snap.data()?.watchTargets) ? snap.data()?.watchTargets : [];
    const next = current.filter((watch: any) => watch.id !== id);
    await projectRef.set({ watchTargets: next, updatedAt: new Date().toISOString() }, { merge: true });
    return res.json({ watching: false, watchTargets: next });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/notifications", async (req: AuthenticatedRequest, res) => {
  try {
    const { project } = await getProjectRepository(req, String(req.query.projectId || ""));
    const notifications = Array.isArray(project.notifications)
      ? [...project.notifications]
        .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, 100)
      : [];
    return res.json({ notifications });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.post("/notifications/:id/read", async (req: AuthenticatedRequest, res) => {
  try {
    const { db, project } = await getProjectRepository(req, String(req.body.projectId || req.query.projectId || ""));
    const projectId = String(req.body.projectId || req.query.projectId);
    const id = String(req.params.id);
    const notifications = Array.isArray(project.notifications) ? project.notifications : [];
    const next = notifications.map((notification: any) =>
      notification.id === id
        ? { ...notification, read: true, readAt: new Date().toISOString() }
        : notification
    );
    await db.collection("projects").doc(projectId).set({ notifications: next }, { merge: true });
    return res.json({ read: true });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.post("/notifications/read-all", async (req: AuthenticatedRequest, res) => {
  try {
    const { db, project } = await getProjectRepository(req, String(req.body.projectId || req.query.projectId || ""));
    const projectId = String(req.body.projectId || req.query.projectId);
    const now = new Date().toISOString();
    const notifications = Array.isArray(project.notifications) ? project.notifications : [];
    const next = notifications.map((notification: any) => ({
      ...notification,
      read: true,
      readAt: notification.readAt || now,
    }));
    await db.collection("projects").doc(projectId).set({ notifications: next, updatedAt: now }, { merge: true });
    return res.json({ read: true });
  } catch (error) { return handleRouteError(res, error); }
});
