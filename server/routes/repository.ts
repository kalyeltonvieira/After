import { Router } from "express";
import type { AuthenticatedRequest } from "../auth.js";
import { requireGitHubUser } from "../auth.js";
import { getAdminFirestore } from "../auth.js";
import { loadProjectContext, listUserProjectsViaRest } from "../projectContext.js";

import { getGitHubToken, getPersistentGitHubToken, readEncryptedGitHubTokenCookie } from "../githubSession.js";
import { parseGitHubRepo, getCompleteRepositoryTree, getGitBlobContent } from "../services/githubService.js";
import { analyzeSource } from "../services/codeAnalyzer.js";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import pathModule from "node:path";
import { isSensitiveFilePath, sanitizeRepoRelativePath } from "../services/sensitiveFileFilter.js";
import { createGitHubBranch, deleteGitHubBranch } from "../services/githubMutations.js";

export const repositoryRouter = Router();

const ghHeaders = (token?: string): Record<string, string> => ({
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "AFTER-Software-Evolution-Platform",
  ...(token ? { Authorization: `Bearer ${token.trim()}` } : {}),
});

const EXTERNAL_REQUEST_TIMEOUT_MS = 15_000;
const BINARY_FILE_EXTENSIONS = new Set([
  "7z", "avi", "bin", "bmp", "class", "doc", "docx", "eot", "gif", "gz", "ico", "jar", "jpeg", "jpg",
  "mov", "mp3", "mp4", "ogg", "otf", "pdf", "png", "ppt", "pptx", "rar", "svgz", "tar", "tif", "tiff",
  "ttf", "wasm", "wav", "webm", "webp", "woff", "woff2", "xls", "xlsb", "xlsm", "xlsx", "zip",
]);

function isBinaryFilePath(filePath: string) {
  const extension = filePath.split(".").pop()?.toLowerCase() || "";
  return BINARY_FILE_EXTENSIONS.has(extension);
}

function contentTypeForPath(filePath: string) {
  const extension = filePath.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, string> = {
    pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    svg: "image/svg+xml", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", mp4: "video/mp4", webm: "video/webm",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return types[extension] || "application/octet-stream";
}

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
      signal: init?.signal || AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS),
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
  const context = await loadProjectContext(projectId, req.user?.uid || "github-user", req.firebaseToken);
  if (!context) {
    throw Object.assign(new Error("Project not found or not owned by the current user."), { status: 404 });
  }
  const project = context.project;
  const parsed = parseGitHubRepo(String(project.repository || ""));
  if (!parsed) {
    throw Object.assign(new Error("This project is not connected to a valid GitHub repository."), { status: 400 });
  }
  const uid = req.user?.uid || "github-user";
  let token = getGitHubToken(req.cookies?.after_github_session, uid)
    || readEncryptedGitHubTokenCookie(req.cookies?.after_github_token)
    || undefined;
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
  const isRateLimit = status === 429 || /rate limit/i.test(message);
  const isUnauthorized = status === 401 || status === 403 || isRateLimit || /unauthorized|bad credentials|permission/i.test(message);

  return res.status(status).json({
    error: message,
    status,
    isUnauthorized,
    isRateLimit,
    isHtml: Boolean(error?.isHtml),
    diagnostic: process.env.NODE_ENV !== "production" ? error?.rawSample || null : null,
  });
}

repositoryRouter.use(requireGitHubUser);

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
    } catch (completeTreeErr: any) {
      const status = Number(completeTreeErr?.status || 0);
      if ([401, 403, 404, 429].includes(status) || /rate limit/i.test(completeTreeErr?.message || "")) {
        console.warn(`GitHub repository tree access restricted (${status || 429}):`, completeTreeErr?.message);
        throw completeTreeErr;
      }
      console.warn("Complete tree fetch failed, trying direct tree query fallback:", completeTreeErr?.message);
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

    return res.status(404).json({
      error: `Could not load repository tree for ${parsed.owner}/${parsed.repo} on branch '${requestedRef || project.defaultBranch || "default"}'. Verify the repository name, branch, and GitHub access permissions.`,
      sha: requestedRef || "HEAD",
      tree: [],
    });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.put("/file", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.body?.projectId || ""));
    const path = sanitizeRepoRelativePath(String(req.body?.path || ""));
    const branch = String(req.body?.branch || project.branch || project.defaultBranch || "").trim();
    const content = String(req.body?.content || "");
    const sha = String(req.body?.sha || "").trim();
    const message = String(req.body?.message || `Update ${path}`).trim().slice(0, 200);
    if (!path) return res.status(400).json({ error: "A valid repository path is required." });
    if (!branch) return res.status(400).json({ error: "A branch is required." });
    if (!token) return res.status(401).json({ error: "Connect GitHub first to edit files." });
    if (isSensitiveFilePath(path)) return res.status(403).json({ error: "Editing sensitive files is restricted by AFTER security policies." });
    if (Buffer.byteLength(content, "utf8") > 2_000_000) return res.status(413).json({ error: "CSV files must be 2 MB or smaller for inline editing." });

    const payload: Record<string, string> = { message, content: Buffer.from(content, "utf8").toString("base64"), branch };
    if (sha) payload.sha = sha;
    const { body } = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json({ path, branch, sha: body?.content?.sha || null, commit: body?.commit || null });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.get("/file", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const rawPath = String(req.query.path || "");
    const path = sanitizeRepoRelativePath(rawPath);
    const requestedRef = String(req.query.ref || project.branch || "").trim();
    if (!path) return res.status(400).json({ error: "A valid repository path is required." });

    if (isSensitiveFilePath(path)) {
      return res.status(403).json({
        error: "Access to sensitive files (.env, keys, credentials) is restricted by AFTER security policies.",
        isBlocked: true,
      });
    }

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
          const bytes = Buffer.from(normalized, "base64");
          if (isBinaryFilePath(path)) {
            return res.json({ path, ref, size: body.size ?? bytes.length, sha: body.sha, contentBase64: bytes.toString("base64"), contentType: contentTypeForPath(path), isBinary: true });
          }
          const content = bytes.toString("utf8");
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
          signal: AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS),
          headers: {
            "User-Agent": "AFTER-Software-Evolution-Platform",
            ...(token ? { Authorization: `token ${token}` } : {}),
          },
        });
        if (rawRes.ok) {
          const bytes = Buffer.from(await rawRes.arrayBuffer());
          const content = isBinaryFilePath(path) ? "" : bytes.toString("utf8");
          if (bytes.length && !content.startsWith("<!DOCTYPE html>") && !content.startsWith("<html>")) {
            return res.json({
              path,
              ref,
              size: bytes.length,
              sha: null,
              ...(isBinaryFilePath(path)
                ? { contentBase64: bytes.toString("base64"), contentType: contentTypeForPath(path), isBinary: true }
                : { content }),
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
          const bytes = Buffer.from(body.content.replace(/\n/g, ""), "base64");
          if (isBinaryFilePath(path)) {
            return res.json({ path, ref: requestedRef || "HEAD", size: body.size ?? bytes.length, sha: reqSha, contentBase64: bytes.toString("base64"), contentType: contentTypeForPath(path), isBinary: true });
          }
          const content = bytes.toString("utf8");
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

    return res.status(404).json({
      error: `File '${path}' was not found in repository ${parsed.owner}/${parsed.repo} at ref '${requestedRef || project.branch || "HEAD"}'.`,
      path,
      ref: requestedRef || project.branch || "HEAD",
      status: 404,
    });
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

    if (token && parsed.owner && parsed.repo) {
      try {
        const response = await fetch("https://api.github.com/graphql", {
          method: "POST",
          signal: AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS),
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

    return res.status(404).json({
      error: `Blame data is unavailable for '${path}'. Connect GitHub with read access to view line authorship.`,
      path,
      ref,
      ranges: [],
    });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

repositoryRouter.get("/branches", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
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
    const body = await createGitHubBranch(githubFetch, parsed.owner, parsed.repo, name, from, token);
    return res.status(201).json({ ref: body });
  } catch (error) { return handleRouteError(res, error); }
});

repositoryRouter.delete("/branches/:name", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, parsed, token } = await getProjectRepository(req, String(req.query.projectId || ""));
    const name = decodeURIComponent(req.params.name);
    if (name === project.defaultBranch) return res.status(409).json({ error: "The default branch cannot be deleted." });
    await deleteGitHubBranch(githubFetch, parsed.owner, parsed.repo, name, token);
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
    const state = String(req.query.state || "all");
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
    const state = String(req.query.state || "all");
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
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ query: q, results: [] });

    let projects: any[] = [];
    if (req.firebaseToken) {
      try {
        projects = await listUserProjectsViaRest(req.user?.uid || "github-user", req.firebaseToken);
      } catch {
        projects = [];
      }
    }
    projects = projects
      .filter((project: any) => parseGitHubRepo(String(project.repository || "")))
      .slice(0, 20);

    const userUid = req.user?.uid || "github-user";
    const results: any[] = [];
    await Promise.all(projects.map(async (project: any) => {
      const parsed = parseGitHubRepo(String(project.repository || ""));
      if (!parsed) return;
      try {
        const [code, commits, issues, pulls] = await Promise.all([
          githubFetch(`/search/code?q=${encodeURIComponent(`${q} repo:${parsed.owner}/${parsed.repo}`)}&per_page=8`, (
          getGitHubToken(req.cookies?.after_github_session, userUid) ||
          String(req.headers["x-github-access-token"] || "").trim() ||
          undefined
        )),
          githubFetch(`/search/commits?q=${encodeURIComponent(`${q} repo:${parsed.owner}/${parsed.repo}`)}&per_page=8`, (
          getGitHubToken(req.cookies?.after_github_session, userUid) ||
          String(req.headers["x-github-access-token"] || "").trim() ||
          undefined
        )),
          githubFetch(`/search/issues?q=${encodeURIComponent(`${q} repo:${parsed.owner}/${parsed.repo}`)}&per_page=8`, (
          getGitHubToken(req.cookies?.after_github_session, userUid) ||
          String(req.headers["x-github-access-token"] || "").trim() ||
          undefined
        )),
          githubFetch(`/search/issues?q=${encodeURIComponent(`${q} repo:${parsed.owner}/${parsed.repo} is:pr`)}&per_page=8`, (
          getGitHubToken(req.cookies?.after_github_session, userUid) ||
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
          getGitHubToken(req.cookies?.after_github_session, userUid) ||
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

repositoryRouter.post("/compare-architecture", async (req: AuthenticatedRequest, res) => {
  try {
    const { parsed, token } = await getProjectRepository(req, String(req.body?.projectId || ""));
    const base = typeof req.body?.base === "string" ? req.body.base.trim() : "";
    const head = typeof req.body?.head === "string" ? req.body.head.trim() : "";
    if (!base || !head) return res.status(400).json({ error: "Both base and head refs are required." });
    if (base === head) return res.status(400).json({ error: "Choose two different refs to compare." });
    if (base.length > 255 || head.length > 255 || base.startsWith("-") || head.startsWith("-")) {
      return res.status(400).json({ error: "Invalid Git reference." });
    }

    const [baseTree, headTree] = await Promise.all([
      getCompleteRepositoryTree(parsed.owner, parsed.repo, base, token),
      getCompleteRepositoryTree(parsed.owner, parsed.repo, head, token),
    ]);
    const baseFiles = new Map(baseTree.tree.filter((item) => item.type === "blob").map((item) => [item.path, item]));
    const headFiles = new Map(headTree.tree.filter((item) => item.type === "blob").map((item) => [item.path, item]));
    const allPaths = new Set([...baseFiles.keys(), ...headFiles.keys()]);
    const sourceExtensions = /\.(tsx?|jsx?|py|go|rs)$/i;
    const candidates = [...allPaths]
      .filter((filePath) => sourceExtensions.test(filePath) && !isSensitiveFilePath(filePath))
      .filter((filePath) => {
        const size = Number(headFiles.get(filePath)?.size ?? baseFiles.get(filePath)?.size ?? 0);
        return size <= 500_000;
      })
      .sort()
      .slice(0, 300);
    const truncated = [...allPaths].filter((filePath) => sourceExtensions.test(filePath) && !isSensitiveFilePath(filePath)).length > candidates.length;

    const baseAnalysis = new Map<string, ReturnType<typeof analyzeSource>>();
    const headAnalysis = new Map<string, ReturnType<typeof analyzeSource>>();
    const work: Array<Promise<void>> = [];
    let cursor = 0;
    const queue = candidates.flatMap((filePath) => [
      { filePath, side: "base" as const, sha: baseFiles.get(filePath)?.sha },
      { filePath, side: "head" as const, sha: headFiles.get(filePath)?.sha },
    ]);

    const runWorker = async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        if (!item.sha) continue;
        try {
          const blob = await getGitBlobContent(parsed.owner, parsed.repo, item.sha, token);
          if (!blob || blob.content.length > 500_000) continue;
          const analysis = analyzeSource(item.filePath, blob.content);
          if (item.side === "base") baseAnalysis.set(item.filePath, analysis);
          else headAnalysis.set(item.filePath, analysis);
        } catch {
          // Keep the comparison partial and disclose the uninspected files.
        }
      }
    };
    for (let worker = 0; worker < 6; worker++) work.push(runWorker());
    await Promise.all(work);

    const files = [...allPaths].map((filePath) => {
      const before = baseFiles.get(filePath);
      const after = headFiles.get(filePath);
      const status = !before ? "added" : !after ? "removed" : before.sha !== after.sha ? "modified" : "unchanged";
      if (status === "unchanged") return null;
      const oldAnalysis = baseAnalysis.get(filePath);
      const newAnalysis = headAnalysis.get(filePath);
      const oldSymbols = new Map((oldAnalysis?.symbols || []).map((symbol) => [`${symbol.type}:${symbol.name}`, symbol]));
      const newSymbols = new Map((newAnalysis?.symbols || []).map((symbol) => [`${symbol.type}:${symbol.name}`, symbol]));
      const addedSymbols = [...newSymbols.keys()].filter((key) => !oldSymbols.has(key)).map((key) => newSymbols.get(key)!);
      const removedSymbols = [...oldSymbols.keys()].filter((key) => !newSymbols.has(key)).map((key) => oldSymbols.get(key)!);
      const modifiedSymbols = [...newSymbols.keys()].filter((key) => oldSymbols.has(key) && JSON.stringify(oldSymbols.get(key)) !== JSON.stringify(newSymbols.get(key)))
        .map((key) => ({ before: oldSymbols.get(key), after: newSymbols.get(key) }));
      const oldImports = new Set((oldAnalysis?.imports || []).map((item) => item.specifier));
      const newImports = new Set((newAnalysis?.imports || []).map((item) => item.specifier));
      return {
        path: filePath,
        status,
        baseSha: before?.sha || null,
        headSha: after?.sha || null,
        symbols: { added: addedSymbols, removed: removedSymbols, modified: modifiedSymbols },
        dependencies: {
          added: [...newImports].filter((item) => !oldImports.has(item)),
          removed: [...oldImports].filter((item) => !newImports.has(item)),
        },
        parser: newAnalysis?.parser || oldAnalysis?.parser || null,
        certainty: newAnalysis?.certainty || oldAnalysis?.certainty || "UNKNOWN",
      };
    }).filter(Boolean);

    const addedFiles = files.filter((file: any) => file.status === "added");
    const removedFiles = files.filter((file: any) => file.status === "removed");
    const modifiedFiles = files.filter((file: any) => file.status === "modified");
    const symbolAdded = files.reduce((sum: number, file: any) => sum + file.symbols.added.length, 0);
    const symbolRemoved = files.reduce((sum: number, file: any) => sum + file.symbols.removed.length, 0);
    const symbolModified = files.reduce((sum: number, file: any) => sum + file.symbols.modified.length, 0);
    const dependencyAdded = files.reduce((sum: number, file: any) => sum + file.dependencies.added.length, 0);
    const dependencyRemoved = files.reduce((sum: number, file: any) => sum + file.dependencies.removed.length, 0);

    return res.json({
      comparison: {
        repository: `${parsed.owner}/${parsed.repo}`,
        base: { ref: base, treeSha: baseTree.sha, truncated: baseTree.truncated },
        head: { ref: head, treeSha: headTree.sha, truncated: headTree.truncated },
        completeness: truncated ? "partial" : "bounded",
        sourceFilesConsidered: candidates.length,
        sourceFilesAnalyzed: new Set([...baseAnalysis.keys(), ...headAnalysis.keys()]).size,
        summary: {
          filesChanged: files.length,
          filesAdded: addedFiles.length,
          filesRemoved: removedFiles.length,
          filesModified: modifiedFiles.length,
          symbolsAdded: symbolAdded,
          symbolsRemoved: symbolRemoved,
          symbolsModified: symbolModified,
          dependenciesAdded: dependencyAdded,
          dependenciesRemoved: dependencyRemoved,
        },
        files: files.slice(0, 200),
        limitations: [
          "AST comparison is limited to supported source file extensions and files up to 500 KB.",
          "Symbol line movement is reported as a modification; semantic behavior is not inferred.",
          ...(truncated ? ["The repository exceeds the 300-file AST comparison cap; results are partial."] : []),
          ...(baseTree.truncated || headTree.truncated ? ["GitHub returned a truncated tree; directory fallback may not include every path."] : []),
        ],
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleRouteError(res, error);
  }
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
      ownerId: req.user?.uid || "github-user",
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
