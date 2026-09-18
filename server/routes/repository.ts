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