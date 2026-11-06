import { Router } from "express";
import type { Response } from "express";
import { getAdminFirestore, requireFirebaseUser, type AuthenticatedRequest } from "../auth.js";
import {
  createGitHubSession,
  getGitHubToken,
  getPersistentGitHubToken,
  persistGitHubToken,
  revokeGitHubSession,
  createEncryptedGitHubTokenCookie,
  readEncryptedGitHubTokenCookie,
} from "../githubSession.js";
import { loadProjectContext, listUserProjectsViaRest, fetchProjectViaRest } from "../projectContext.js";
import { enqueueIncrementalAnalysis } from "../services/incrementalAnalysis.js";
import { persistGraphSnapshot } from "../services/graphStore.js";
import { analyzeSource } from "../services/codeAnalyzer.js";
import { calculateImpact } from "../services/graphAnalysis.js";
import {
  parseGitHubRepo,
  sanitizeGitHubRepo,
  getAuthenticatedUser,
  listUserRepositoryPage,
  getRepositoryBranches,
  linkRepositoryToAfter,
  getCompleteRepositoryTree,
  getGitBlobContent,
  searchPublicRepositories,
} from "../services/githubService.js";

export const projectsRouter = Router();
export { parseGitHubRepo, sanitizeGitHubRepo };

/**
 * Validates and sanitizes a candidate Firestore document ID or path segment.
 * Ensures the value is a non-empty string without forward slashes or invalid references (., ..).
 */
export function validateFirestoreDocPath(docId: unknown): string | null {
  if (typeof docId !== "string") return null;
  const trimmed = docId.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || trimmed.includes("/") || trimmed.length > 1500) {
    return null;
  }
  return trimmed;
}

async function resolveGitHubToken(
  req: AuthenticatedRequest,
  res?: Response
): Promise<string | null> {
  const uid = req.user!.uid;
  const liveToken = getGitHubToken(req.cookies?.after_github_session, uid);
  if (liveToken) return liveToken;

  const cookieToken = readEncryptedGitHubTokenCookie(req.cookies?.after_github_token);
  if (cookieToken) return cookieToken;

  try {
    const persistedToken = await getPersistentGitHubToken(uid);
    if (!persistedToken) return null;

    if (res && typeof res.cookie === "function") {
      const sessionId = createGitHubSession(uid, persistedToken);
      res.cookie("after_github_session", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });
    }
    return persistedToken;
  } catch (error: any) {
    console.warn("Could not restore persisted GitHub token:", error?.message || error);
    return null;
  }
}

// Validate username format and reserved names
projectsRouter.get("/validate-username", (req, res) => {
  const username = String(req.query.username || "").toLowerCase().trim();

  if (!username) {
    return res.status(400).json({ valid: false, message: "Username cannot be empty" });
  }

  const regex = /^[a-z0-9_]{3,30}$/;
  if (!regex.test(username)) {
    return res.status(400).json({
      valid: false,
      message: "Username must be 3-30 characters (lowercase letters, numbers, underscores only)",
    });
  }

  const reserved = ["admin", "root", "after", "support", "system", "api", "auth", "settings", "null", "undefined"];
  if (reserved.includes(username)) {
    return res.status(400).json({ valid: false, message: "This username is reserved" });
  }

  return res.json({ valid: true, username });
});

// Establish the AFTER GitHub session from the OAuth credential returned by Firebase Auth.
projectsRouter.post("/github-session", requireFirebaseUser, async (req: AuthenticatedRequest, res: Response) => {
  const githubAccessToken = String(req.body?.githubAccessToken || "").trim();
  if (!githubAccessToken) return res.status(400).json({ error: "GitHub OAuth credential is required." });

  try {
    const githubUser = await getAuthenticatedUser(githubAccessToken);
    const sessionId = createGitHubSession(req.user!.uid, githubAccessToken);

    try {
      await persistGitHubToken(req.user!.uid, githubAccessToken);
    } catch (persistenceError: any) {
      // GitHub login remains valid even when server-side token persistence is unavailable.
      console.warn(
        "GitHub token persistence skipped:",
        persistenceError?.message || persistenceError
      );
    }

    res.cookie("after_github_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.cookie("after_github_token", createEncryptedGitHubTokenCookie(githubAccessToken), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({ user: githubUser });
  } catch (err: any) {
    return res.status(401).json({ error: err?.message || "Invalid GitHub OAuth credential." });
  }
});

// End both browser sessions without disconnecting the persisted GitHub integration.
projectsRouter.post("/github-session/revoke", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  await revokeGitHubSession(req.cookies?.after_github_session, req.user!.uid);
  res.clearCookie("after_github_session", { path: "/" });
  res.clearCookie("after_github_token", { path: "/" });
  return res.json({ ok: true });
});

// Get the GitHub identity associated with the server-side session.
projectsRouter.get("/github-user", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const token = await resolveGitHubToken(req, res);
  if (!token) return res.status(401).json({ error: "Connect GitHub first." });
  try {
    const user = await getAuthenticatedUser(token);
    return res.json({ user });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// List every accessible repository by following GitHub pagination server-side.
projectsRouter.get("/github-repos", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const token = await resolveGitHubToken(req, res);
  if (!token) return res.status(401).json({ error: "Connect GitHub first." });
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(req.query.per_page) || 24, 1), 100);
    const result = await listUserRepositoryPage(token, { page, per_page: perPage });
    return res.json({ ...result, page, perPage });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Search public GitHub repositories
projectsRouter.get("/github-search", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ total_count: 0, items: [] });

  const token = (await resolveGitHubToken(req, res)) || undefined;
  const perPage = Math.min(Math.max(Number(req.query.per_page) || 20, 1), 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const sort = req.query.sort === "forks" || req.query.sort === "updated" ? req.query.sort : "stars";
  const minimumStars = Math.max(0, Math.min(1_000_000_000, Number(req.query.minimum_stars) || 0));
  const language = ["TypeScript", "JavaScript", "Python", "Go", "Rust"].includes(String(req.query.language))
    ? String(req.query.language)
    : undefined;
  const license = ["mit", "apache-2.0", "gpl-3.0", "bsd-3-clause", "mpl-2.0"].includes(String(req.query.license))
    ? String(req.query.license)
    : undefined;
  const topic = typeof req.query.topic === "string" && req.query.topic.trim() ? req.query.topic.trim() : undefined;

  try {
    const result = await searchPublicRepositories(q, token, {
      per_page: perPage,
      page,
      sort,
      minimumStars,
      language,
      license,
      topic,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to search GitHub repositories." });
  }
});

// List Branches for a repository
projectsRouter.get("/github-branches", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const repository = typeof req.query.repository === "string" ? req.query.repository.trim() : "";
  const token = (await resolveGitHubToken(req, res)) || undefined;

  if (!repository) {
    return res.status(400).json({ error: "Repository identifier or URL is required." });
  }

  const parsed = parseGitHubRepo(repository);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid repository format. Please enter as 'owner/repo' or a full GitHub URL." });
  }

  try {
    const branches = await getRepositoryBranches(parsed.owner, parsed.repo, token);
    return res.json({ branches });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Link Repository to AFTER platform
projectsRouter.post("/github-link", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { repository, branch } = req.body || {};
  const token = (await resolveGitHubToken(req, res)) || undefined;
  const webhookBaseUrl = req.headers.origin || (req.headers.host ? `${req.protocol}://${req.headers.host}` : undefined);

  if (!repository || typeof repository !== "string" || !repository.trim()) {
    return res.status(400).json({ error: "Repository identifier or URL is required." });
  }

  const parsed = parseGitHubRepo(repository);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid repository format. Please enter as 'owner/repo' or a full GitHub URL." });
  }

  try {
    const result = await linkRepositoryToAfter(`${parsed.owner}/${parsed.repo}`, token, {
      requestedBranch: branch,
      webhookBaseUrl,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Configure or repair the GitHub webhook used by Continuous Observation.
projectsRouter.post("/webhook", requireFirebaseUser, async (req: AuthenticatedRequest, res: Response) => {
  const projectId = validateFirestoreDocPath(req.body?.projectId);
  if (!projectId) return res.status(400).json({ error: "A valid, non-empty projectId is required." });
  if (!process.env.GITHUB_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "GITHUB_WEBHOOK_SECRET is not configured." });
  }

  const context = await loadProjectContext(projectId, req.user!.uid, req.firebaseToken);
  if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });

  const token = (await resolveGitHubToken(req, res)) || undefined;
  if (!token) return res.status(401).json({ error: "Connect GitHub first." });

  try {
    const webhookBaseUrl =
      String(req.headers.origin || "").replace(/\/$/, "") ||
      `${req.protocol}://${req.get("host")}`;
    const result = await linkRepositoryToAfter(String(context.project.repository || ""), token, {
      requestedBranch: String(context.project.branch || context.project.defaultBranch || ""),
      webhookBaseUrl,
    });

    try {
      await getAdminFirestore().collection("projects").doc(projectId).set({
        webhookConfigured: Boolean(result.webhookConfigured),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (fsErr: any) {
      console.warn("Could not save webhook status to Firestore:", fsErr?.message || fsErr);
    }

    if (!result.webhookConfigured) {
      return res.status(502).json({
        ...result,
        error: result.message || "GitHub did not accept the Continuous Observation webhook.",
      });
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "Could not configure GitHub webhook." });
  }
});

async function computeProjectStatistics(
  context: {
    project: Record<string, any> & { id: string };
    timeline: any[];
    insights: any[];
    experiments: any[];
    memoryEntries: any[];
    graphNodes: any[];
    graphEdges: any[];
  },
  githubToken?: string
) {
  const project = context.project;
  const events = context.timeline || [];
  const graphNodes = context.graphNodes || [];

  // 1. Commits calculation: prioritize explicit project commits or timeline commit events
  const commitEvents = events.filter((e: any) => {
    return (
      e.id?.startsWith("commit_") ||
      e.metadata?.type === "commit" ||
      String(e.event || "").toLowerCase().includes("commit") ||
      Boolean(e.metadata?.sha)
    );
  });

  let totalCommits =
    Number(project.totalCommits) ||
    Number(project.statistics?.totalCommits) ||
    commitEvents.length;

  if (totalCommits === 0 && events.length > 0) {
    totalCommits = events.length;
  }

  // 2. Active Contributors: unique actors from git commits, PRs, and software memory events
  const contributorMap = new Map<string, { name: string; avatarUrl?: string; contributions: number }>();
  events.forEach((e: any) => {
    const actor = String(e.actor || "").trim();
    if (actor && actor !== "Unknown" && actor !== "Git Author") {
      const existing = contributorMap.get(actor) || { name: actor, contributions: 0 };
      existing.contributions += 1;
      if (e.metadata?.avatarUrl && !existing.avatarUrl) {
        existing.avatarUrl = e.metadata.avatarUrl;
      }
      contributorMap.set(actor, existing);
    }
  });

  let activeContributors = contributorMap.size;
  if (project.activeContributors) {
    activeContributors = Math.max(activeContributors, Number(project.activeContributors));
  } else if (project.statistics?.activeContributors) {
    activeContributors = Math.max(activeContributors, Number(project.statistics.activeContributors));
  }

  // 3. Lines of Code calculation: from analysis or verified language byte breakdown
  let linesOfCode = Number(project.linesOfCode) || Number(project.statistics?.linesOfCode) || 0;

  // GitHub telemetry enrichment when token is present
  let languagesBreakdown: Record<string, number> = project.languages || {};
  if (githubToken && project.repository) {
    try {
      const parsed = parseGitHubRepo(project.repository);
      if (parsed) {
        const ghHeaders = {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "AFTER-Software-Evolution-Platform",
          Authorization: `Bearer ${githubToken}`,
        };
        const langRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/languages`,
          { headers: ghHeaders }
        );
        if (langRes.ok) {
          const langs = await langRes.json();
          if (langs && typeof langs === "object" && Object.keys(langs).length > 0) {
            languagesBreakdown = langs as Record<string, number>;
            const totalBytes: number = (Object.values(langs) as number[]).reduce((acc: number, val: number) => acc + (Number(val) || 0), 0);
            if (Number(totalBytes) > 0) {
              linesOfCode = Math.round(Number(totalBytes) / 32);
            }
          }
        }
      }
    } catch {
      // Non-blocking fallback
    }
  }

  const contributorsList = Array.from(contributorMap.values())
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, 10);

  return {
    linesOfCode,
    totalCommits,
    activeContributors,
    fileCount: graphNodes.length || Number(project.fileCount) || 0,
    architectureNodes: graphNodes.length,
    architectureEdges: context.graphEdges?.length || 0,
    insightsCount: context.insights?.length || 0,
    experimentsCount: context.experiments?.length || 0,
    openIssues: Number(project.openIssues) || 0,
    stars: Number(project.stars) || 0,
    branch: project.branch || project.defaultBranch || "main",
    lastActivity: events[0]?.timestamp || project.updatedAt || new Date().toISOString(),
    contributors: contributorsList,
    languages: languagesBreakdown,
  };
}

// GET /api/projects - Retrieves project statistics and metrics for the selected project, or lists user projects
projectsRouter.get("/", requireFirebaseUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestedId = req.query.projectId || req.query.id;
    const githubToken = (await resolveGitHubToken(req, res)) || undefined;

    if (requestedId) {
      const cleanId = validateFirestoreDocPath(requestedId);
      if (!cleanId) return res.status(400).json({ error: "A valid, non-empty projectId is required." });

      const context = await loadProjectContext(cleanId, req.user!.uid, req.firebaseToken);
      if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });

      const statistics = await computeProjectStatistics(context, githubToken);

      return res.json({
        projectId: cleanId,
        project: {
          id: cleanId,
          name: context.project.name,
          description: context.project.description,
          repository: context.project.repository,
          branch: context.project.branch,
          framework: context.project.framework,
          language: context.project.language,
          createdAt: context.project.createdAt,
          updatedAt: context.project.updatedAt,
        },
        statistics,
      });
    }

    // List all projects for current user using authenticated token
    let projectsList: any[] = [];
    if (req.firebaseToken) {
      try {
        projectsList = await listUserProjectsViaRest(req.user!.uid, req.firebaseToken);
      } catch {
        projectsList = [];
      }
    }

    const projectsWithStats = await Promise.all(
      projectsList.map(async (proj) => {
        const events = Array.isArray(proj.events) ? proj.events : [];
        const graphNodes = Array.isArray(proj.graphNodes) ? proj.graphNodes : [];
        const commitCount =
          events.filter((e: any) => e.id?.startsWith("commit_") || e.metadata?.type === "commit").length ||
          events.length;
        const uniqueActors = new Set(events.map((e: any) => e.actor).filter(Boolean));

        return {
          id: proj.id,
          name: proj.name,
          repository: proj.repository,
          branch: proj.branch,
          framework: proj.framework,
          language: proj.language,
          createdAt: proj.createdAt,
          updatedAt: proj.updatedAt,
          statistics: {
            linesOfCode: proj.linesOfCode || (graphNodes.length ? graphNodes.length * 115 : 1450),
            totalCommits: proj.totalCommits || commitCount,
            activeContributors: uniqueActors.size || 1,
            architectureNodes: graphNodes.length,
            openIssues: proj.openIssues || 0,
            stars: proj.stars || 0,
          },
        };
      })
    );

    return res.json({
      projects: projectsWithStats,
      totalProjects: projectsWithStats.length,
    });
  } catch (error: any) {
    console.error("GET /api/projects error:", error);
    return res.status(500).json({ error: error?.message || "Failed to retrieve projects." });
  }
});

// GET /api/projects/:projectId - Retrieves specific project with computed statistics
projectsRouter.get("/:projectId", requireFirebaseUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cleanId = validateFirestoreDocPath(req.params.projectId);
    if (!cleanId) return res.status(400).json({ error: "Invalid projectId." });

    const githubToken = (await resolveGitHubToken(req, res)) || undefined;
    const context = await loadProjectContext(cleanId, req.user!.uid, req.firebaseToken);
    if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });

    const statistics = await computeProjectStatistics(context, githubToken);

    return res.json({
      projectId: cleanId,
      project: context.project,
      statistics,
    });
  } catch (error: any) {
    console.error("GET /api/projects/:projectId error:", error);
    return res.status(500).json({ error: error?.message || "Failed to retrieve project statistics." });
  }
});

// Persistent analysis job status and explicit incremental re-processing.
projectsRouter.get("/analysis-jobs/latest", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = validateFirestoreDocPath(req.query.projectId);
    if (!projectId) return res.status(400).json({ error: "A valid, non-empty projectId is required." });
    const context = await loadProjectContext(projectId, req.user!.uid, req.firebaseToken);
    if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });
    const jobs = Array.isArray(context.project.analysisJobs)
      ? [...context.project.analysisJobs]
          .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
          .slice(0, 20)
      : [];
    return res.json({ jobs });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Failed to retrieve analysis jobs." });
  }
});

projectsRouter.post("/analysis-jobs", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, changedFiles, removedFiles, commitSha } = req.body || {};
    const cleanProjectId = validateFirestoreDocPath(projectId);
    if (!cleanProjectId) return res.status(400).json({ error: "A valid, non-empty projectId is required." });
    const context = await loadProjectContext(cleanProjectId, req.user!.uid, req.firebaseToken);
    if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });
    const project: any = context.project;
    const files = Array.isArray(changedFiles) ? changedFiles.filter((value: any) => typeof value === "string") : [];
    const removed = Array.isArray(removedFiles) ? removedFiles.filter((value: any) => typeof value === "string") : [];
    if (files.length + removed.length === 0) return res.status(400).json({ error: "changedFiles or removedFiles is required." });
    const branch = String(project.branch || project.defaultBranch || "");
    const queued = await enqueueIncrementalAnalysis({
      projectId: cleanProjectId,
      ownerId: req.user!.uid,
      branch,
      changedFiles: files,
      removedFiles: removed,
      commitSha: typeof commitSha === "string" ? commitSha : undefined,
    });
    return res.status(202).json(queued);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Failed to enqueue incremental analysis." });
  }
});

// Calculate direct and transitive impact from persisted, evidence-backed graph edges.
projectsRouter.post("/impact", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = validateFirestoreDocPath(req.body?.projectId);
    const nodeId = typeof req.body?.nodeId === "string" && req.body.nodeId.trim() ? req.body.nodeId.trim() : null;
    if (!projectId || !nodeId) return res.status(400).json({ error: "A valid, non-empty projectId and nodeId are required." });
    const context = await loadProjectContext(projectId, req.user!.uid, req.firebaseToken);
    if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });
    const node = context.graphNodes.find((item: any) => item.id === nodeId);
    if (!node) return res.status(404).json({ error: "Graph node not found." });
    // Graph edge convention: A -> B means "A imports/depends on B".
    // Impact must therefore traverse incoming edges: who depends on the selected node?
    const directDependentEdges = context.graphEdges.filter((edge: any) => edge.to === nodeId);
    const directDependencyEdges = context.graphEdges.filter((edge: any) => edge.from === nodeId);
    const transitiveDependentIds = new Set<string>();
    const queue = directDependentEdges.map((edge: any) => edge.from);

    while (queue.length) {
      const id = queue.shift()!;
      if (transitiveDependentIds.has(id) || id === nodeId) continue;
      transitiveDependentIds.add(id);
      context.graphEdges
        .filter((edge: any) => edge.to === id)
        .forEach((edge: any) => queue.push(edge.from));
    }

    return res.json({
      node,
      directDependents: directDependentEdges.map((edge: any) => ({
        ...edge,
        node: context.graphNodes.find((item: any) => item.id === edge.from) || null,
      })),
      directDependencies: directDependencyEdges.map((edge: any) => ({
        ...edge,
        node: context.graphNodes.find((item: any) => item.id === edge.to) || null,
      })),
      transitiveDependents: [...transitiveDependentIds]
        .map((id) => context.graphNodes.find((item: any) => item.id === id))
        .filter(Boolean),
      evidence: [...directDependentEdges, ...directDependencyEdges]
        .map((edge: any) => edge.evidence)
        .filter(Boolean),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Failed to calculate architecture impact." });
  }
});


// Real Repository Analysis Engine
projectsRouter.post("/analyze-repository", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { repository, branch: requestedBranch } = req.body || {};
  const githubToken = (await resolveGitHubToken(req, res)) || undefined;

  const cleanRepo = sanitizeGitHubRepo(repository);
  if (!cleanRepo) {
    return res.status(400).json({
      error: "Invalid repository format. Please enter as 'owner/repo' or a full GitHub URL (e.g., 'facebook/react' or 'https://github.com/facebook/react').",
    });
  }

  const parsed = parseGitHubRepo(cleanRepo);
  if (!parsed) {
    return res.status(400).json({
      error: "Invalid repository format. Please enter as 'owner/repo' or a full GitHub URL (e.g., 'facebook/react' or 'https://github.com/facebook/react').",
    });
  }

  const { owner, repo } = parsed;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "AFTER-Software-Evolution-Platform",
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    // 1. Fetch Repository Metadata
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        return res.status(404).json({
          error: `Repository '${owner}/${repo}' not found on GitHub. If this is a private repository, please authorize via GitHub OAuth or provide a Personal Access Token.`,
        });
      }
      if (repoRes.status === 403) {
        const rateLimitRemaining = repoRes.headers.get("x-ratelimit-remaining");
        const rateLimited = rateLimitRemaining === "0";
        return res.status(rateLimited ? 429 : 403).json({
          error: rateLimitRemaining === "0"
            ? "GitHub API rate limit exceeded. Reconnect GitHub to refresh the authenticated session, then try again."
            : "Access denied to repository. A GitHub token with repo access is required.",
          retryAfter: repoRes.headers.get("retry-after"),
        });
      }
      return res.status(repoRes.status).json({
        error: `GitHub API error: ${repoRes.statusText}`,
      });
    }

    const repoText = await repoRes.text();
    let repoData: any = null;
    try {
      repoData = JSON.parse(repoText);
    } catch {
      return res.status(502).json({
        error: `GitHub returned an HTML/non-JSON response for '${owner}/${repo}'. Please verify repository permissions.`,
      });
    }
    const branch = requestedBranch || repoData.default_branch || "main";

    // 2. Fetch Recent Real Commits for Timeline
    let realEvents: any[] = [];
    try {
      const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=15`, { headers });
      if (commitsRes.ok) {
        const commitsText = await commitsRes.text();
        let commits: any = null;
        try { commits = JSON.parse(commitsText); } catch { commits = []; }
        if (Array.isArray(commits)) {
          realEvents = commits.map((c: any, index: number) => {
            const dateStr = c.commit?.author?.date || c.commit?.committer?.date || new Date().toISOString();
            const author = c.commit?.author?.name || c.author?.login || "Git Author";
            const message = (c.commit?.message || "Commit to repository").split("\n")[0];
            const shaShort = c.sha?.substring(0, 7) || "commit";

            return {
              id: `commit_${c.sha || index}`,
              event: message,
              actor: author,
              timestamp: new Date(dateStr).toISOString(),
              affectedComponents: [repoData.full_name],
              reason: `Commit ${shaShort} on branch ${branch}.`,
              metadata: {
                sha: shaShort,
                fullSha: c.sha,
                url: c.html_url,
              },
            };
          });
        }
      }
    } catch (commitErr) {
      console.warn("Could not fetch commits:", commitErr);
    }

    // Observe recent PRs, issues, and releases as first-class Software Memory evidence.
    const observedRecords: { pullRequests: any[]; issues: any[]; releases: any[] } = {
      pullRequests: [],
      issues: [],
      releases: [],
    };

    if (githubToken) await Promise.all([
      (async () => {
        try {
          const response = await fetch(
            "https://api.github.com/repos/" + owner + "/" + repo + "/pulls?state=all&sort=updated&direction=desc&per_page=20",
            { headers }
          );
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) observedRecords.pullRequests = data;
          }
        } catch (error) {
          console.warn("Could not fetch pull requests for Software Memory:", error);
        }
      })(),
      (async () => {
        try {
          const response = await fetch(
            "https://api.github.com/repos/" + owner + "/" + repo + "/issues?state=all&sort=updated&direction=desc&per_page=20",
            { headers }
          );
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) observedRecords.issues = data.filter((item: any) => !item.pull_request);
          }
        } catch (error) {
          console.warn("Could not fetch issues for Software Memory:", error);
        }
      })(),
      (async () => {
        try {
          const response = await fetch(
            "https://api.github.com/repos/" + owner + "/" + repo + "/releases?per_page=20",
            { headers }
          );
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) observedRecords.releases = data;
          }
        } catch (error) {
          console.warn("Could not fetch releases for Software Memory:", error);
        }
      })(),
    ]);

    realEvents = [
      ...realEvents,
      ...observedRecords.pullRequests.slice(0, 12).map((pr: any) => ({
        id: "pull_" + pr.id,
        event: "PR #" + pr.number + ": " + pr.title,
        actor: pr.user?.login || pr.user?.name || "Unknown",
        timestamp: new Date(pr.updated_at || pr.created_at).toISOString(),
        affectedComponents: [],
        reason: "Pull request #" + pr.number + " was observed in GitHub.",
        metadata: {
          type: "pull_request",
          pullRequest: pr.number,
          url: pr.html_url,
        },
      })),
      ...observedRecords.issues.slice(0, 12).map((issue: any) => ({
        id: "issue_" + issue.id,
        event: "Issue #" + issue.number + ": " + issue.title,
        actor: issue.user?.login || issue.user?.name || "Unknown",
        timestamp: new Date(issue.updated_at || issue.created_at).toISOString(),
        affectedComponents: [],
        reason: "Issue #" + issue.number + " was observed in GitHub.",
        metadata: {
          type: "issue",
          issue: issue.number,
          url: issue.html_url,
        },
      })),
      ...observedRecords.releases.slice(0, 12).map((release: any) => ({
        id: "release_" + release.id,
        event: "Release: " + (release.name || release.tag_name),
        actor: release.author?.login || release.author?.name || "Unknown",
        timestamp: new Date(release.published_at || release.created_at).toISOString(),
        affectedComponents: [],
        reason: "GitHub release " + (release.tag_name || release.id) + " was observed.",
        metadata: {
          type: "release",
          tag: release.tag_name,
          url: release.html_url,
        },
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);

    const observedMemoryEntries = realEvents.map((event: any) => ({
      type: event.metadata?.type === "pull_request"
        ? "pull_request"
        : event.metadata?.type === "issue"
        ? "issue"
        : event.metadata?.type === "release"
        ? "release"
        : "commit",
      title: event.event,
      summary: event.reason,
      status: "KNOWN",
      evidence: [event.metadata?.url || event.reason].filter(Boolean),
      source: {
        kind: event.metadata?.type ? "github_" + event.metadata.type : "github_commit",
        id: event.metadata?.pullRequest || event.metadata?.issue || event.metadata?.tag || event.metadata?.fullSha || event.metadata?.sha,
        url: event.metadata?.url,
      },
      relatedFiles: [],
      createdAt: event.timestamp,
      observedAt: new Date().toISOString(),
    }));

    // 3. Fetch the complete repository tree. Large Git trees can be truncated by GitHub.
    let treeItems: any[] = [];
    try {
      const completeTree = await getCompleteRepositoryTree(owner, repo, branch, githubToken || undefined);
      treeItems = completeTree.tree;
    } catch (treeErr) {
      console.warn("Could not fetch complete repository tree:", treeErr);
    }
    if (treeItems.length === 0) {
      return res.status(502).json({ error: "Could not read the repository tree from GitHub." });
    }

    // 4. Fetch and Parse package.json if present
    let packageJson: any = null;
    try {
      const pkgRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json?ref=${branch}`, { headers });
      if (pkgRes.ok) {
        const pkgText = await pkgRes.text();
        let pkgData: any = null;
        try { pkgData = JSON.parse(pkgText); } catch { pkgData = null; }
        if (pkgData?.content) {
          const raw = Buffer.from(pkgData.content, "base64").toString("utf-8");
          packageJson = JSON.parse(raw);
        }
      }
    } catch {
      // No package.json or invalid JSON
    }

    // 5. Detect Real Framework & Language
    let detectedLanguage = repoData.language || "TypeScript";
    let detectedFramework = "Standard Repository";

    const allPaths = treeItems.map((t) => t.path.toLowerCase());

    if (packageJson) {
      const allDeps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };

      if (allDeps["next"]) {
        detectedFramework = "Next.js";
      } else if (allDeps["@vitejs/plugin-react"] || allDeps["vite"]) {
        detectedFramework = "React (Vite)";
      } else if (allDeps["@angular/core"]) {
        detectedFramework = "Angular";
      } else if (allDeps["vue"]) {
        detectedFramework = "Vue";
      } else if (allDeps["@remix-run/react"]) {
        detectedFramework = "Remix";
      } else if (allDeps["astro"]) {
        detectedFramework = "Astro";
      } else if (allDeps["express"]) {
        detectedFramework = "Express (Node.js)";
      } else if (allDeps["react"]) {
        detectedFramework = "React";
      } else {
        detectedFramework = "Node.js";
      }
    } else {
      if (allPaths.some((p) => p.includes("requirements.txt") || p.includes("pyproject.toml"))) {
        detectedLanguage = "Python";
        detectedFramework = allPaths.some((p) => p.includes("fastapi"))
          ? "FastAPI"
          : allPaths.some((p) => p.includes("django"))
          ? "Django"
          : "Python Service";
      } else if (allPaths.some((p) => p.includes("go.mod"))) {
        detectedLanguage = "Go";
        detectedFramework = "Go Module";
      } else if (allPaths.some((p) => p.includes("cargo.toml"))) {
        detectedLanguage = "Rust";
        detectedFramework = "Rust Crate";
      }
    }

    // 6. Construct Real Architecture Graph Nodes from actual files
    const graphNodes: any[] = [];
    const graphEdges: any[] = [];
    const seenNodeIds = new Set<string>();
    const seenFilePaths = new Set<string>();
    const seenEdgeKeys = new Set<string>();

    const addGraphNode = (node: any) => {
      if (!node || !node.id) return false;
      if (seenNodeIds.has(node.id)) return false;
      if (node.filePath && !node.parentId && seenFilePaths.has(node.filePath)) return false;

      seenNodeIds.add(node.id);
      if (node.filePath && !node.parentId) {
        seenFilePaths.add(node.filePath);
      }
      graphNodes.push(node);
      return true;
    };

    const addGraphEdge = (edge: any) => {
      if (!edge || !edge.from || !edge.to) return false;
      const key = `${edge.from}_${edge.to}_${edge.label || "link"}`;
      if (seenEdgeKeys.has(key)) return false;
      seenEdgeKeys.add(key);
      graphEdges.push(edge);
      return true;
    };

    // Filter file blobs only. Source content is fetched only for bounded, analyzable files.
    const fileBlobs = treeItems.filter((t) => t.type === "blob");
    const sourceCandidates = fileBlobs
      .filter((f) => /\.(tsx?|jsx?|vue|py|go|rs)$/.test(f.path.toLowerCase()) && !/(^|\/)(node_modules|vendor|dist|build|coverage)(\/|$)/.test(f.path))
      .filter((f) => Number(f.size || 0) <= 2_000_000);
    const sourceContents = new Map<string, string>();
    const concurrency = 8;
    for (let offset = 0; offset < sourceCandidates.length; offset += concurrency) {
      const batch = sourceCandidates.slice(offset, offset + concurrency);
      await Promise.all(batch.map(async (file) => {
        try {
          const contentData = await getGitBlobContent(owner, repo, file.sha, githubToken || undefined);
          if (contentData && contentData.content.length <= 1_500_000) {
            sourceContents.set(file.path, contentData.content);
          }
        } catch {
          // An individual unreadable file must not invalidate repository analysis.
        }
      }));
    }

    // A. Detect Pages
    const pageFiles = fileBlobs.filter((f) => {
      const p = f.path.toLowerCase();
      return (
        (p.includes("src/pages/") ||
          p.includes("pages/") ||
          p.includes("src/app/") ||
          p.includes("app/")) &&
        (p.endsWith(".tsx") || p.endsWith(".jsx") || p.endsWith(".vue") || p.endsWith(".html")) &&
        !p.includes(".test.") &&
        !p.includes(".spec.")
      );
    });

    for (const file of pageFiles.slice(0, 8)) {
      const baseName = file.path.split("/").pop() || file.path;
      const nodeId = `page_${file.path.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      addGraphNode({
        id: nodeId,
        label: baseName,
        type: "page",
        category: "frontend",
        status: "monitored",
        changesCount: 0,
        filePath: file.path,
        symbol: baseName.replace(/\.[^/.]+$/, ""),
        line: 1,
        description: `Application view file mapped directly from repository.`,
      });
    }

    // B. Detect Components
    const compFiles = fileBlobs.filter((f) => {
      const p = f.path.toLowerCase();
      return (
        (p.includes("components/") || p.includes("views/")) &&
        (p.endsWith(".tsx") || p.endsWith(".jsx") || p.endsWith(".vue")) &&
        !p.includes(".test.") &&
        !p.includes(".spec.")
      );
    });

    for (const file of compFiles.slice(0, 10)) {
      const baseName = file.path.split("/").pop() || file.path;
      const nodeId = `comp_${file.path.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      addGraphNode({
        id: nodeId,
        label: baseName,
        type: "component",
        category: "frontend",
        status: "monitored",
        changesCount: 0,
        filePath: file.path,
        symbol: baseName.replace(/\.[^/.]+$/, ""),
        line: 1,
        description: `UI Component declared in ${file.path}.`,
        lastModified: "Synchronized with repository",
      });
    }

    // C. Detect APIs & Routes
    const apiFiles = fileBlobs.filter((f) => {
      const p = f.path.toLowerCase();
      return (
        (p.includes("api/") ||
          p.includes("routes/") ||
          p.includes("controllers/") ||
          p.includes("server/")) &&
        (p.endsWith(".ts") || p.endsWith(".js") || p.endsWith(".go") || p.endsWith(".py")) &&
        !p.includes(".test.")
      );
    });

    for (const file of apiFiles.slice(0, 8)) {
      const baseName = file.path.split("/").pop() || file.path;
      const nodeId = `api_${file.path.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      addGraphNode({
        id: nodeId,
        label: baseName,
        type: "api",
        category: "backend",
        status: "monitored",
        changesCount: 0,
        filePath: file.path,
        symbol: baseName.replace(/\.[^/.]+$/, ""),
        endpoint: `/api/${baseName.replace(/\.[^/.]+$/, "")}`,
        line: 1,
        description: `Backend routing or API handler in ${file.path}.`,
        lastModified: "Synchronized with repository",
      });
    }

    // D. Detect Logic Functions / Services
    const logicFiles = fileBlobs.filter((f) => {
      const p = f.path.toLowerCase();
      return (
        (p.includes("services/") ||
          p.includes("utils/") ||
          p.includes("lib/") ||
          p.includes("helpers/")) &&
        (p.endsWith(".ts") || p.endsWith(".js") || p.endsWith(".py") || p.endsWith(".go")) &&
        !p.includes(".test.") &&
        !p.includes(".d.ts")
      );
    });

    for (const file of logicFiles.slice(0, 8)) {
      const baseName = file.path.split("/").pop() || file.path;
      const nodeId = `fn_${file.path.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      addGraphNode({
        id: nodeId,
        label: baseName,
        type: "function",
        category: "logic",
        status: "monitored",
        changesCount: 0,
        filePath: file.path,
        symbol: baseName.replace(/\.[^/.]+$/, ""),
        line: 1,
        description: `Business logic and service utilities in ${file.path}.`,
        lastModified: "Synchronized with repository",
      });
    }

    // E. Detect Configurations
    const configFiles = fileBlobs.filter((f) => {
      const p = f.path.toLowerCase();
      return (
        p.endsWith("config.js") ||
        p.endsWith("config.ts") ||
        p.endsWith("config.mjs") ||
        p.endsWith("tsconfig.json") ||
        p.endsWith("dockerfile") ||
        p.endsWith(".rules") ||
        p.endsWith(".env.example")
      );
    });

    for (const file of configFiles.slice(0, 6)) {
      const baseName = file.path.split("/").pop() || file.path;
      const nodeId = `cfg_${file.path.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      addGraphNode({
        id: nodeId,
        label: baseName,
        type: "config",
        category: "config",
        status: "monitored",
        changesCount: 0,
        filePath: file.path,
        configKey: baseName,
        line: 1,
        description: `Project system configuration in ${file.path}.`,
        lastModified: "Synchronized with repository",
      });
    }

    // F. Detect all declared dependencies from package.json.
    if (packageJson) {
      const dependencyGroups = [
        { field: "dependencies", kind: "production" },
        { field: "devDependencies", kind: "development" },
        { field: "optionalDependencies", kind: "optional" },
        { field: "peerDependencies", kind: "peer" },
      ];

      const seenDependencyNames = new Set<string>();
      for (const group of dependencyGroups) {
        const entries = Object.entries(packageJson[group.field] || {});
        for (const [depName, version] of entries) {
          if (seenDependencyNames.has(depName)) continue;
          seenDependencyNames.add(depName);
          const nodeId = `dep_${depName.replace(/[^a-zA-Z0-9_]/g, "_")}`;
          addGraphNode({
            id: nodeId,
            label: `${depName}@${version}`,
            type: "dependency",
            category: "external",
            status: "monitored",
            changesCount: 0,
            dependency: depName,
            filePath: "package.json",
            configKey: group.kind,
            description: `${group.kind} dependency declared in package.json.`,
          });
        }
      }
    }

    // Symbol extraction: use the shared AST/heuristic analyzer so initial and incremental analysis agree.
    for (const [filePath, source] of sourceContents) {
      const parentNode = graphNodes.find((node: any) => node.filePath === filePath && !node.parentId);
      if (!parentNode) continue;

      const analysis = analyzeSource(filePath, source);
      for (const symbol of analysis.symbols.slice(0, 24)) {
        const symbolId = `symbol_${filePath.replace(/[^a-zA-Z0-9_]/g, "_")}_${symbol.name.replace(/[^a-zA-Z0-9_]/g, "_")}`;
        if (graphNodes.some((node: any) => node.id === symbolId)) continue;
        addGraphNode({
          id: symbolId,
          label: symbol.name,
          type: symbol.type === "variable" && /^(tsx|jsx)$/.test(filePath.split(".").pop() || "") && /^[A-Z]/.test(symbol.name) ? "component" : symbol.type,
          category: parentNode.category,
          status: "monitored",
          changesCount: 0,
          filePath,
          symbol: symbol.name,
          line: symbol.line,
          endLine: symbol.endLine,
          parentId: parentNode.id,
          exported: symbol.exported,
          parser: analysis.parser,
          certainty: analysis.certainty,
          description: `Symbol ${symbol.name} observed in ${filePath}.`,
        });
        addGraphEdge({
          from: parentNode.id,
          to: symbolId,
          label: "contains",
          evidence: `${analysis.parser} parser observed ${symbol.name} at ${filePath}:${symbol.line}.`,
        });
      }
    }

    // Connect entities using import statements from real source contents.
    const nodeByPath = new Map<string, any>();
    for (const node of graphNodes) {
      // Only map file-level nodes here; symbol nodes have parentId and share filePath.
      if (node.filePath && !node.parentId) nodeByPath.set(node.filePath, node);
    }
    for (const file of sourceCandidates) {
      if (!nodeByPath.has(file.path) && !seenFilePaths.has(file.path)) {
        const node = {
          id: `file_${file.path.replace(/[^a-zA-Z0-9_]/g, "_")}`,
          label: file.path.split("/").pop() || file.path,
          type: "file", category: "source", status: "healthy", changesCount: 1,
          filePath: file.path, symbol: file.path.split("/").pop()?.replace(/\.[^/.]+$/, ""), line: 1,
          description: "Source file observed in the repository tree.",
        };
        if (addGraphNode(node)) {
          nodeByPath.set(file.path, node);
        }
      }
    }
    const dependencyByName = new Map(graphNodes.filter((n) => n.type === "dependency").map((n) => [n.dependency, n]));
    const resolveImport = (fromPath: string, specifier: string) => {
      if (!specifier.startsWith(".")) return null;
      const base = fromPath.split("/").slice(0, -1).join("/");
      const raw = `${base}/${specifier}`.replace(/\/\.\//g, "/").replace(/\/\/+/g, "/");
      const candidates = [raw, `${raw}.ts`, `${raw}.tsx`, `${raw}.js`, `${raw}.jsx`, `${raw}.vue`, `${raw}/index.ts`, `${raw}/index.tsx`, `${raw}/index.js`];
      return candidates.find((candidate) => nodeByPath.has(candidate)) || null;
    };
    for (const [filePath, content] of sourceContents) {
      const from = nodeByPath.get(filePath);
      if (!from) continue;
      const imports = new Set<string>();
      const importPatterns = [
        /(?:import\s+(?:[^;]*?\s+from\s+)?|export\s+[^;]*?\s+from\s+|require\s*\(\s*|from\s+)["']([^"']+)["']/g,
        /(?:^|\n)\s*(?:from\s+|import\s+)["']([^"']+)["']/g,
      ];
      for (const pattern of importPatterns) { let match; while ((match = pattern.exec(content))) imports.add(match[1]); }
      for (const specifier of imports) {
        const targetPath = resolveImport(filePath, specifier);
        if (targetPath) {
          const target = nodeByPath.get(targetPath);
          if (target) addGraphEdge({ from: from.id, to: target.id, label: "imports", evidence: `${filePath} imports ${specifier}` });
        } else {
          const dep = dependencyByName.get(specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/"));
          if (dep) addGraphEdge({ from: from.id, to: dep.id, label: "imports", evidence: `${filePath} imports ${specifier}` });
        }
      }
    }

    // 7. Grounded Real Insights based strictly on real files
    const realInsights: any[] = [];

    // Check 1: Unpinned dependencies in package.json
    if (packageJson && packageJson.dependencies) {
      const caretDeps = Object.entries(packageJson.dependencies)
        .filter(([_, v]) => typeof v === "string" && (v.startsWith("^") || v.startsWith("~")))
        .map(([name, v]) => `${name}@${v}`);

      if (caretDeps.length > 0) {
        realInsights.push({
          id: `ins_unpinned_${Date.now()}`,
          title: "Floating semver ranges in production dependencies",
          category: "Dependency",
          impact: "medium",
          confidence: "high",
          evidence: `package.json specifies dynamic version ranges for ${caretDeps.slice(0, 3).join(", ")}${caretDeps.length > 3 ? ` and ${caretDeps.length - 3} others` : ""}.`,
          description: `Dependencies specified with ^ or ~ allow unexpected minor or patch upgrades during automated builds without lockfile verification.`,
          affectedComponents: ["package.json"],
          affectedFiles: ["package.json"],
          suggestedAction: "Pin exact dependency versions or enforce npm ci with package-lock.json in continuous integration.",
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Check 2: TypeScript configuration inspection
    const hasTsConfig = allPaths.some((p) => p.includes("tsconfig.json"));
    const hasTypeScriptFiles = fileBlobs.some((f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx"));
    if (hasTypeScriptFiles && !hasTsConfig) {
      realInsights.push({
        id: `ins_tsconfig_${Date.now()}`,
        title: "TypeScript files present without root tsconfig.json",
        category: "Architecture",
        impact: "high",
        confidence: "high",
        evidence: `Found ${hasTypeScriptFiles ? "TypeScript source files" : "source code"} but no tsconfig.json in the repository root.`,
        description: "Without a defined tsconfig.json, compiler options and module resolution strategies default to non-strict environment defaults.",
        affectedComponents: ["Root Configuration"],
        affectedFiles: ["tsconfig.json"],
        suggestedAction: "Generate tsconfig.json with strict: true and target: ES2022.",
        createdAt: new Date().toISOString(),
      });
    }

    // Check 3: Missing test suite or test scripts
    if (packageJson && packageJson.scripts) {
      if (!packageJson.scripts.test || packageJson.scripts.test.includes("no test specified")) {
        realInsights.push({
          id: `ins_test_suite_${Date.now()}`,
          title: "No automated test suite configured in package.json",
          category: "Bug risk",
          impact: "medium",
          confidence: "high",
          evidence: `package.json "scripts.test" is missing or set to placeholder exit code.`,
          description: "Changes cannot be automatically verified against regression baselines without a configured testing script.",
          affectedComponents: ["package.json"],
          affectedFiles: ["package.json"],
          suggestedAction: "Configure Vitest, Jest, or Playwright to safeguard core code paths.",
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Check 4: Repository open issues check
    if (repoData.open_issues_count && repoData.open_issues_count > 25) {
      realInsights.push({
        id: `ins_issues_${Date.now()}`,
        title: `High backlog of open issues (${repoData.open_issues_count})`,
        category: "Opportunity",
        impact: "low",
        confidence: "high",
        evidence: `GitHub repository reports ${repoData.open_issues_count} open issues or pull requests.`,
        description: `Accumulated open issues can indicate architectural friction or pending dependency updates.`,
        affectedComponents: [repoData.name],
        affectedFiles: [repoData.name],
        suggestedAction: "Triage oldest open issues and categorize by regression impact.",
        createdAt: new Date().toISOString(),
      });
    }

    let webhookConfigured = false;
    const requestedProjectId = validateFirestoreDocPath(req.body?.projectId);
    if (requestedProjectId && req.firebaseToken) {
      try {
        const proj = await fetchProjectViaRest(requestedProjectId, req.firebaseToken);
        if (proj) {
          webhookConfigured = Boolean(proj.webhookConfigured);
        }
      } catch {
        // Non-blocking fallback
      }
    }

    if (
      githubToken &&
      repoData.permissions?.admin &&
      process.env.GITHUB_WEBHOOK_SECRET
    ) {
      try {
        const webhookBaseUrl =
          String(req.headers.origin || "").replace(/\/$/, "") ||
          `${req.protocol}://${req.get("host")}`;
        const webhookResult = await linkRepositoryToAfter(
          `${owner}/${repo}`,
          githubToken,
          { requestedBranch: branch, webhookBaseUrl }
        );
        webhookConfigured = Boolean(webhookResult.webhookConfigured);
      } catch (error: any) {
        console.warn("Could not configure GitHub webhook during repository analysis:", error?.message || error);
      }
    }

    // Return real extracted architecture
    return res.json({
      project: {
        name: repoData.name,
        description: repoData.description || `Monitored GitHub repository (${repoData.full_name})`,
        repository: sanitizeGitHubRepo(repoData.full_name) || `${owner}/${repo}`,
        branch,
        defaultBranch: repoData.default_branch || "main",
        framework: detectedFramework,
        language: detectedLanguage,
        stars: repoData.stargazers_count || 0,
        openIssues: repoData.open_issues_count || 0,
        githubConnected: true,
        telemetryConnected: false,
        webhookConfigured,
      },
      graphNodes,
      graphEdges,
      analysis: {
        sourceFilesInspected: sourceContents.size,
        sourceFilesAvailable: sourceCandidates.length,
        relationshipEvidence: "imports extracted from repository source content",
      },
      events: realEvents,
      insights: realInsights,
      memoryEntries: observedMemoryEntries,
    });
  } catch (err: any) {
    console.error("Error analyzing repository:", err);
    return res.status(500).json({
      error: `Failed to analyze repository: ${err.message || "Unknown error occurred."}`,
    });
  }
});

/**
 * Impact Analysis Engine Endpoint
 * Computes direct and transitive dependencies, affected tests/APIs, and blast radius.
 */
projectsRouter.post("/impact-analysis", requireFirebaseUser, async (req: AuthenticatedRequest, res: Response) => {
  const projectId = validateFirestoreDocPath(req.body?.projectId);
  const nodeId = String(req.body?.nodeId || "").trim();

  if (!projectId || !nodeId) {
    return res.status(400).json({ error: "projectId and nodeId are required." });
  }

  const context = await loadProjectContext(projectId, req.user!.uid, req.firebaseToken);
  if (!context) {
    return res.status(404).json({ error: "Project not found or not owned by the current user." });
  }

  const impact = calculateImpact(nodeId, context.graphNodes, context.graphEdges);
  if (!impact) {
    return res.status(404).json({ error: `Node ${nodeId} not found in the project's product graph.` });
  }

  return res.json({ impact });
});
