import { Router } from "express";
import type { Response } from "express";
import { getAdminFirestore, requireFirebaseUser, type AuthenticatedRequest } from "../auth.js";
import {
  createGitHubSession,
  getGitHubToken,
  getPersistentGitHubToken,
  persistGitHubToken,
  revokeGitHubSession,
} from "../githubSession.js";
import { loadProjectContext } from "../projectContext.js";
import { enqueueIncrementalAnalysis } from "../services/incrementalAnalysis.js";
import {
  parseGitHubRepo,
  getAuthenticatedUser,
  listUserRepositories,
  getRepositoryBranches,
  linkRepositoryToAfter,
} from "../services/githubService.js";

export const projectsRouter = Router();
export { parseGitHubRepo };

async function resolveGitHubToken(
  req: AuthenticatedRequest,
  res: Response
): Promise<string | null> {
  const uid = req.user!.uid;
  const liveToken = getGitHubToken(req.cookies?.after_github_session, uid);
  if (liveToken) return liveToken;

  const cachedToken = String(req.headers["x-github-access-token"] || "").trim();
  if (cachedToken) {
    const sessionId = createGitHubSession(uid, cachedToken);
    res.cookie("after_github_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    return cachedToken;
  }

  try {
    const persistedToken = await getPersistentGitHubToken(uid);
    if (!persistedToken) return null;

    const sessionId = createGitHubSession(uid, persistedToken);
    res.cookie("after_github_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
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

    return res.json({ user: githubUser });
  } catch (err: any) {
    return res.status(401).json({ error: err?.message || "Invalid GitHub OAuth credential." });
  }
});

// End both browser sessions without disconnecting the persisted GitHub integration.
projectsRouter.post("/github-session/revoke", async (req, res) => {
  revokeGitHubSession(req.cookies?.after_github_session);
  res.clearCookie("after_github_session", { path: "/" });
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
    const repos = await listUserRepositories(token, { page: 1, per_page: 100 });
    return res.json({ repos });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// List Branches for a repository
projectsRouter.get("/github-branches", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const repository = req.query.repository as string;
  const token = (await resolveGitHubToken(req, res)) || undefined;

  const parsed = parseGitHubRepo(repository);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid repository format" });
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
  const { repository, branch } = req.body;
  const token = (await resolveGitHubToken(req, res)) || undefined;
  const webhookBaseUrl = req.headers.origin || (req.headers.host ? `${req.protocol}://${req.headers.host}` : undefined);

  if (!repository) {
    return res.status(400).json({ error: "Repository is required" });
  }

  try {
    const result = await linkRepositoryToAfter(repository, token, {
      requestedBranch: branch,
      webhookBaseUrl,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Persistent analysis job status and explicit incremental re-processing.
projectsRouter.get("/analysis-jobs/latest", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const projectId = String(req.query.projectId || "");
  if (!projectId) return res.status(400).json({ error: "projectId is required." });
  const context = await loadProjectContext(projectId, req.user!.uid);
  if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });
  const db = getAdminFirestore();
  const snap = await db.collection("projects").doc(projectId).collection("analysisJobs")
    .orderBy("createdAt", "desc").limit(10).get();
  return res.json({ jobs: snap.docs.map((doc) => doc.data()) });
});

projectsRouter.post("/analysis-jobs", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { projectId, changedFiles, removedFiles, commitSha } = req.body || {};
  if (!projectId) return res.status(400).json({ error: "projectId is required." });
  const context = await loadProjectContext(String(projectId), req.user!.uid);
  if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });
  const files = Array.isArray(changedFiles) ? changedFiles.filter((value: any) => typeof value === "string") : [];
  const removed = Array.isArray(removedFiles) ? removedFiles.filter((value: any) => typeof value === "string") : [];
  if (files.length + removed.length === 0) return res.status(400).json({ error: "changedFiles or removedFiles is required." });
  const branch = String(context.project.branch || context.project.defaultBranch || "");
  const queued = await enqueueIncrementalAnalysis({
    projectId: String(projectId),
    ownerId: req.user!.uid,
    branch,
    changedFiles: files,
    removedFiles: removed,
    commitSha: typeof commitSha === "string" ? commitSha : undefined,
  });
  return res.status(202).json(queued);
});

// Calculate direct and transitive impact from persisted, evidence-backed graph edges.
projectsRouter.post("/impact", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { projectId, nodeId } = req.body;
  if (!projectId || !nodeId) return res.status(400).json({ error: "projectId and nodeId are required." });
  const context = await loadProjectContext(String(projectId), req.user!.uid);
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
});

// Real Repository Analysis Engine
projectsRouter.post("/analyze-repository", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { repository, branch: requestedBranch } = req.body;
  const githubToken = (await resolveGitHubToken(req, res)) || undefined;

  const parsed = parseGitHubRepo(repository);
  if (!parsed) {
    return res.status(400).json({
      error: "Invalid repository format. Please enter as 'owner/repo' or a full GitHub URL (e.g., 'facebook/react' or 'https://github.com/vercel/next.js').",
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
        return res.status(403).json({
          error: rateLimitRemaining === "0"
            ? "GitHub API rate limit exceeded. Please connect your GitHub account or supply a token."
            : "Access denied to repository. A GitHub token with repo access is required.",
        });
      }
      return res.status(repoRes.status).json({
        error: `GitHub API error: ${repoRes.statusText}`,
      });
    }

    const repoData = await repoRes.json();
    const branch = requestedBranch || repoData.default_branch || "main";

    // 2. Fetch Recent Real Commits for Timeline
    let realEvents: any[] = [];
    try {
      const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=15`, { headers });
      if (commitsRes.ok) {
        const commits = await commitsRes.json();
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

    // 3. Fetch Real File Tree
    let treeItems: any[] = [];
    try {
      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
      if (treeRes.ok) {
        const treeData = await treeRes.json();
        if (treeData && Array.isArray(treeData.tree)) {
          treeItems = treeData.tree;
        }
      }
    } catch (treeErr) {
      console.warn("Could not fetch recursive git tree:", treeErr);
    }

    // Fallback if git trees failed or empty: fetch root contents
    if (treeItems.length === 0) {
      try {
        const contentsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`, { headers });
        if (contentsRes.ok) {
          const contents = await contentsRes.json();
          if (Array.isArray(contents)) {
            treeItems = contents.map((item: any) => ({
              path: item.path,
              type: item.type === "dir" ? "tree" : "blob",
              size: item.size,
            }));
          }
        }
      } catch (contentsErr) {
        console.warn("Could not fetch root contents:", contentsErr);
      }
    }

    // 4. Fetch and Parse package.json if present
    let packageJson: any = null;
    try {
      const pkgRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json?ref=${branch}`, { headers });
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json();
        if (pkgData.content) {
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

    // Filter file blobs only. Source content is fetched only for bounded, analyzable files.
    const fileBlobs = treeItems.filter((t) => t.type === "blob");
    const sourceCandidates = fileBlobs.filter((f) => /\.(tsx?|jsx?|vue|py|go|rs)$/.test(f.path.toLowerCase()) && !/(node_modules|vendor|dist|build|coverage)\//.test(f.path)).slice(0, 120);
    const sourceContents = new Map<string, string>();
    await Promise.all(sourceCandidates.map(async (file) => {
      try {
        const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${encodeURIComponent(branch)}`;
        const contentRes = await fetch(contentUrl, { headers });
        if (!contentRes.ok) return;
        const contentData = await contentRes.json();
        if (contentData.encoding === "base64" && typeof contentData.content === "string") {
          const content = Buffer.from(contentData.content.replace(/\n/g, ""), "base64").toString("utf-8");
          if (content.length <= 250_000) sourceContents.set(file.path, content);
        }
      } catch {
        // An individual unreadable file must not invalidate the repository analysis.
      }
    }));

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
      graphNodes.push({
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
      graphNodes.push({
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
      graphNodes.push({
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
      graphNodes.push({
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
      graphNodes.push({
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
          graphNodes.push({
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

    // Symbol extraction: build symbol-level entities from real source text.
    // This is intentionally parser-light so it works across TS/JS/Python/Go/Rust
    // without inventing symbols when the source cannot be parsed confidently.
    const symbolPatterns: Array<{ regex: RegExp; type: string }> = [
      { regex: /(?:export\s+default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g, type: "function" },
      { regex: /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g, type: "function" },
      { regex: /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g, type: "function" },
      { regex: /\bdef\s+([A-Za-z_][\w]*)\s*\(/g, type: "function" },
      { regex: /\bclass\s+([A-Za-z_][\w]*)\s*[:(]/g, type: "function" },
      { regex: /\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_][\w]*)\s*\(/g, type: "function" },
      { regex: /\bfn\s+([A-Za-z_][\w]*)\s*\(/g, type: "function" },
    ];

    for (const [filePath, source] of sourceContents) {
      const parentNode = graphNodes.find((node: any) => node.filePath === filePath);
      if (!parentNode) continue;

      const seenSymbols = new Set<string>();
      for (const pattern of symbolPatterns) {
        pattern.regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.regex.exec(source)) && seenSymbols.size < 12) {
          const symbol = match[1];
          if (!symbol || seenSymbols.has(symbol)) continue;
          seenSymbols.add(symbol);

          const line = source.slice(0, match.index).split("\n").length;
          const symbolType = /^[A-Z]/.test(symbol) && /\.(tsx|jsx|vue)$/.test(filePath)
            ? "component"
            : pattern.type;
          const symbolId = `symbol_${filePath.replace(/[^a-zA-Z0-9_]/g, "_")}_${symbol.replace(/[^a-zA-Z0-9_]/g, "_")}`;

          if (graphNodes.some((node: any) => node.id === symbolId)) continue;

          graphNodes.push({
            id: symbolId,
            label: symbol,
            type: symbolType,
            category: parentNode.category,
            status: "monitored",
            changesCount: 0,
            filePath,
            symbol,
            line,
            parentId: parentNode.id,
            description: `Symbol ${symbol} observed in ${filePath}.`,
          });

          graphEdges.push({
            from: parentNode.id,
            to: symbolId,
            label: "contains",
            evidence: `${filePath} contains symbol ${symbol} at line ${line}.`,
          });
        }
      }
    }

    // Connect entities using import statements from real source contents.
    const nodeByPath = new Map<string, any>();
    for (const node of graphNodes) {
      // Only map file-level nodes here; symbol nodes have parentId and share filePath.
      if (node.filePath && !node.parentId) nodeByPath.set(node.filePath, node);
    }
    for (const file of sourceCandidates) {
      if (!nodeByPath.has(file.path)) {
        const node = {
          id: `file_${file.path.replace(/[^a-zA-Z0-9_]/g, "_")}`,
          label: file.path.split("/").pop() || file.path,
          type: "function", category: "source", status: "healthy", changesCount: 1,
          filePath: file.path, symbol: file.path.split("/").pop()?.replace(/\.[^/.]+$/, ""), line: 1,
          description: "Source file observed in the repository tree.",
        };
        graphNodes.push(node);
        nodeByPath.set(file.path, node);
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
          if (target && !graphEdges.some((e) => e.from === from.id && e.to === target.id && e.label === "imports")) graphEdges.push({ from: from.id, to: target.id, label: "imports", evidence: `${filePath} imports ${specifier}` });
        } else {
          const dep = dependencyByName.get(specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/"));
          if (dep && !graphEdges.some((e) => e.from === from.id && e.to === dep.id && e.label === "imports")) graphEdges.push({ from: from.id, to: dep.id, label: "imports", evidence: `${filePath} imports ${specifier}` });
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

    // Return real extracted architecture
    return res.json({
      project: {
        name: repoData.name,
        description: repoData.description || `Monitored GitHub repository (${repoData.full_name})`,
        repository: repoData.full_name,
        branch,
        defaultBranch: repoData.default_branch || "main",
        framework: detectedFramework,
        language: detectedLanguage,
        stars: repoData.stargazers_count || 0,
        openIssues: repoData.open_issues_count || 0,
        githubConnected: true,
        telemetryConnected: false,
      },
      graphNodes,
      graphEdges,
      analysis: { sourceFilesInspected: sourceContents.size, sourceFilesAvailable: sourceCandidates.length, relationshipEvidence: "imports extracted from repository source content" },
      events: realEvents,
      insights: realInsights,
    });
  } catch (err: any) {
    console.error("Error analyzing repository:", err);
    return res.status(500).json({
      error: `Failed to analyze repository: ${err.message || "Unknown error occurred."}`,
    });
  }
});
