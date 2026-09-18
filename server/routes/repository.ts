import { Router } from "express";
import type { AuthenticatedRequest } from "../auth.js";
import { requireFirebaseUser } from "../auth.js";
import { getAdminFirestore } from "../auth.js";

import { getGitHubToken } from "../githubSession.js";
import { parseGitHubRepo } from "../services/githubService.js";
import crypto from "node:crypto";

export const repositoryRouter = Router();

const ghHeaders = (token?: string): Record<string, string> => ({
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "AFTER-Software-Evolution-Platform",
  ...(token ? { Authorization: `Bearer ${token.trim()}` } : {}),
});

function githubError(status: number, statusText: string, body?: any): Error {
  const detail = body?.message ? `: ${body.message}` : "";
  const error = new Error(`GitHub API error (${status})${detail || ` ${statusText}`}`);
  (error as any).status = status;
  return error;
}

async function githubFetch(path: string, token?: string, init?: RequestInit) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      ...ghHeaders(token),
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw githubError(response.status, response.statusText, body);
  return { response, body };
}

async function getProjectRepository(req: AuthenticatedRequest, projectId: string) {
  if (!projectId) throw Object.assign(new Error("projectId is required."), { status: 400 });
  const db = getAdminFirestore();
  const snap = await db.collection("projects").doc(projectId).get();
  if (!snap.exists || snap.data()?.ownerId !== req.user!.uid) {
    throw Object.assign(new Error("Project not found or not owned by the current user."), { status: 404 });
  }
  const project = { ...snap.data(), id: projectId } as any;
  const parsed = parseGitHubRepo(String(project.repository || ""));
  if (!parsed) {
    throw Object.assign(new Error("This project is not connected to a valid GitHub repository."), { status: 400 });
  }
  const token =
    getGitHubToken(req.cookies?.after_github_session, req.user!.uid) ||
    String(req.headers["x-github-access-token"] || "").trim() ||
    undefined;
  return { db, project, parsed, token };
}

function handleRouteError(res: any, error: any) {
  const status = Number(error?.status) || 500;
  return res.status(status).json({ error: error?.message || "Repository operation failed." });
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
    const ref = String(req.query.ref || project.branch || "");
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token);
    const excluded = /(^|\/)(node_modules|\.git|dist|build|coverage|\.cache|venv|__pycache__)($|\/)/;
    const tree = Array.isArray(body?.tree) ? body.tree.filter((item: any) => !excluded.test(String(item.path || ""))) : [];
    return res.json({ sha: body?.sha || ref, truncated: Boolean(body?.truncated), tree });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/file", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const path = String(req.query.path || "").replace(/^\/+/, "");
    const ref = String(req.query.ref || project.branch || "");
    if (!path) return res.status(400).json({ error: "path is required." });
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`, token);
    if (body?.type !== "file" || typeof body?.content !== "string") {
      return res.status(400).json({ error: "The requested path is not a text file." });
    }
    const normalized = body.content.replace(/\n/g, "");
    const content = Buffer.from(normalized, "base64").toString("utf8");
    const binary = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|mp4|mov|avi|wasm|exe|dmg)$/i.test(path);
    if (binary) return res.status(415).json({ error: "Binary files are not displayed in the code browser." });
    if (content.length > 1_000_000) return res.status(413).json({ error: "File is too large for the browser (limit: 1 MB)." });
    return res.json({ path, ref, size: body.size, sha: body.sha, content });
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
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(ref)}&page=${page}&per_page=${perPage}`, token);
    return res.json({ commits: Array.isArray(body) ? body : [] });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/file-blame", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const path = String(req.query.path || "").replace(/^\/+/, "");
    const ref = String(req.query.ref || project.branch || project.defaultBranch || "");
    if (!path) return res.status(400).json({ error: "path is required." });
    if (!token) return res.status(401).json({ error: "GitHub authorization is required for line blame." });

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
    if (!response.ok) return res.status(response.status).json({ error: payload?.message || "GitHub GraphQL blame request failed." });
    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      return res.status(502).json({ error: payload.errors.map((item: any) => item.message).join("; ") });
    }

    const ranges = payload?.data?.repository?.object?.blame?.ranges;
    return res.json({
      path,
      ref,
      ranges: Array.isArray(ranges)
        ? ranges.map((range: any) => ({
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
          }))
        : [],
    });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

repositoryRouter.get("/branches", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 100));
    const { body, response } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/branches?page=${page}&per_page=${perPage}`, token);
    return res.json({ branches: Array.isArray(body) ? body : [], link: response.headers.get("link") || null });
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
    const { body: refData } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${encodeURIComponent(from)}`, token);
    const sha = refData?.object?.sha;
    if (!sha) return res.status(404).json({ error: `Base branch '${from}' was not found.` });
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/git/refs`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${name}`, sha }),
    });
    return res.status(201).json({ ref: body });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.delete("/branches/:name", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const name = decodeURIComponent(req.params.name);
    if (name === project.defaultBranch) return res.status(409).json({ error: "The default branch cannot be deleted." });
    await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/git/refs/heads/${encodeURIComponent(name)}`, token, { method: "DELETE" });
    return res.status(204).send();
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/commits", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 30));
    const ref = String(req.query.ref || project.branch || "");
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/commits?sha=${encodeURIComponent(ref)}&page=${page}&per_page=${perPage}`, token);
    return res.json({ commits: Array.isArray(body) ? body : [] });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/commits/:sha", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const sha = decodeURIComponent(req.params.sha);
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/commits/${encodeURIComponent(sha)}`, token);
    return res.json({ commit: body });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/pulls", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const state = String(req.query.state || "open");
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 30));
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/pulls?state=${encodeURIComponent(state)}&page=${page}&per_page=${perPage}&sort=updated&direction=desc`, token);
    return res.json({ pulls: Array.isArray(body) ? body : [] });
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
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const state = String(req.query.state || "open");
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 30));
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/issues?state=${encodeURIComponent(state)}&page=${page}&per_page=${perPage}&sort=updated&direction=desc`, token);
    const issues = Array.isArray(body) ? body.filter((item: any) => !item.pull_request) : [];
    return res.json({ issues });
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
    const db = getAdminFirestore();
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ query: q, results: [] });

    const projectSnap = await db.collection("projects").where("ownerId", "==", req.user!.uid).get();
    const projects = projectSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as any)
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
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 30));
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/releases?page=${page}&per_page=${perPage}`, token);
    return res.json({ releases: Array.isArray(body) ? body : [] });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/contributors", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 30));
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/contributors?anon=false&page=${page}&per_page=${perPage}`, token);
    return res.json({ contributors: Array.isArray(body) ? body : [] });
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
    const data = snap.data() || {};
    const current = Array.isArray(data.watchTargets) ? data.watchTargets : [];
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
