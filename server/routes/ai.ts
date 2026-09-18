import { Router } from "express";
import { generateContentWithFallback } from "../gemini.js";
import { requireFirebaseUser, type AuthenticatedRequest } from "../auth.js";
import { loadProjectContext } from "../projectContext.js";
import { getGitHubToken } from "../githubSession.js";
import { parseGitHubRepo } from "../services/githubService.js";

export const aiRouter = Router();

function resolveRequestGitHubToken(req: AuthenticatedRequest): string | undefined {
  const sessionToken = getGitHubToken(req.cookies?.after_github_session, req.user!.uid);
  if (sessionToken) return sessionToken;

  const headerToken = String(req.headers["x-github-access-token"] || "").trim();
  return headerToken || undefined;
}


// Endpoint: Why? Engine
aiRouter.post("/why", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { nodeName, nodeType, projectId } = req.body;
  const context = projectId ? await loadProjectContext(String(projectId), req.user!.uid) : null;
  if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });
  const projectContext: any = context.project;
  const recentEvents = context.timeline;
  const dependencies = context.graphNodes.filter((node: any) => node.type === "dependency").map((node: any) => node.label);

  if (!nodeName) {
    return res.status(400).json({ error: "nodeName is required" });
  }

  const node = context.graphNodes.find((item: any) =>
    item?.id === nodeName || item?.label?.toLowerCase() === String(nodeName).toLowerCase()
  );

  let fileHistory: any[] = [];
  let focusedFileContent = "";
  if (node?.filePath) {
    const parsedRepo = parseGitHubRepo(String(projectContext?.repository || ""));
    const token = resolveRequestGitHubToken(req);
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "AFTER-Software-Evolution-Platform",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    if (parsedRepo) {
      try {
        const ref = String(projectContext?.branch || projectContext?.defaultBranch || "");
        const encodedPath = String(node.filePath).split("/").map(encodeURIComponent).join("/");
        const [fileRes, historyRes] = await Promise.all([
          fetch(
            `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}` ,
            { headers }
          ),
          fetch(
            `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/commits?path=${encodeURIComponent(node.filePath)}&sha=${encodeURIComponent(ref)}&per_page=12`,
            { headers }
          ),
        ]);

        if (fileRes.ok) {
          const file = await fileRes.json();
          if (typeof file?.content === "string") {
            focusedFileContent = Buffer.from(file.content.replace(/\n/g, ""), "base64")
              .toString("utf8")
              .slice(0, 20000);
          }
        }

        if (historyRes.ok) {
          const history = await historyRes.json();
          if (Array.isArray(history)) fileHistory = history;
        }
      } catch (error: any) {
        console.warn("Could not resolve Why Engine file evidence:", error?.message);
      }
    }
  }

  const systemPrompt = `You are AFTER's architectural forensics engine.
AFTER monitors software evolution and explains the rationale behind systems.
Your core principle: "OBSERVE → ENTENDER → EXPLICAR → DETECTAR → SUGERIR → EXPERIMENTAR → MONITORAR".

Rule: DO NOT fabricate historical facts.
You MUST categorize your statements into:
- KNOWN: Facts grounded in the provided project context, logs, and events.
- INFERRED: Logical deductions based on architecture patterns and dependency relationships.
- UNKNOWN: Gaps where no commit log, comment, or telemetry explicitly explains the rationale.

Analyze the requested entity:
Entity: "${nodeName}" (Type: ${nodeType || "component"})

Answer with structured JSON:
{
  "entityName": "${nodeName}",
  "summary": "Brief 1-2 sentence executive explanation",
  "whyExists": {
    "status": "KNOWN" | "INFERRED" | "UNKNOWN",
    "explanation": "Why this element exists and original intent"
  },
  "createdContext": {
    "status": "KNOWN" | "INFERRED" | "UNKNOWN",
    "explanation": "When and in what context it was introduced"
  },
  "problemSolved": {
    "status": "KNOWN" | "INFERRED" | "UNKNOWN",
    "explanation": "What specific user, system, or business problem it addressed"
  },
  "dependencies": {
    "status": "KNOWN" | "INFERRED" | "UNKNOWN",
    "dependsOn": ["list of elements this relies on"],
    "dependedOnBy": ["list of elements that break if this is removed"]
  },
  "removalRisks": {
    "status": "KNOWN" | "INFERRED" | "UNKNOWN",
    "riskLevel": "low" | "medium" | "high" | "critical",
    "details": ["Specific cascading failure points if removed"]
  },
  "recommendation": "Preserve, Refactor, Monitor, or Deprecate with brief rationale"
}`;

  const prompt = `Project context:
${JSON.stringify(projectContext || {}, null, 2)}

Recent Events & Timeline:
${JSON.stringify(recentEvents || [], null, 2)}

Software Memory:
${JSON.stringify((context as any).memoryEntries || [], null, 2)}

Entity Evidence:
${JSON.stringify({
  node: node || null,
  fileHistory,
  focusedFileContent: focusedFileContent || null,
}, null, 2)}

Dependencies:
${JSON.stringify(dependencies || [], null, 2)}

Explain WHY "${nodeName}" exists and analyze its architectural impact using the entity evidence first.`;

  try {
    const rawText = await generateContentWithFallback({
      contents: prompt,
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.2,
    });

    const parsed = JSON.parse(rawText || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.warn("Gemini unavailable for /api/gemini/why:", error?.message);

    const nodeId = node?.id;
    const outgoing = nodeId
      ? context.graphEdges.filter((edge: any) => edge.from === nodeId)
      : [];
    const incoming = nodeId
      ? context.graphEdges.filter((edge: any) => edge.to === nodeId)
      : [];
    const directDependencies = outgoing
      .map((edge: any) => context.graphNodes.find((item: any) => item.id === edge.to))
      .filter(Boolean)
      .map((item: any) => item.label);
    const directDependents = incoming
      .map((edge: any) => context.graphNodes.find((item: any) => item.id === edge.from))
      .filter(Boolean)
      .map((item: any) => item.label);

    return res.json({
      entityName: node?.label || nodeName,
      summary: node?.filePath
        ? `Repository evidence maps "${node?.label || nodeName}" to ${node.filePath}.`
        : "No model-generated rationale is available for this entity.",
      whyExists: {
        status: "UNKNOWN",
        explanation: "No explicit rationale was found in the available repository evidence."
      },
      createdContext: {
        status: "UNKNOWN",
        explanation: "The available project ledger does not establish when or why this element was introduced."
      },
      problemSolved: {
        status: "UNKNOWN",
        explanation: "No explicit problem statement was found in the available repository evidence."
      },
      dependencies: {
        status: nodeId && (directDependencies.length || directDependents.length) ? "KNOWN" : "UNKNOWN",
        dependsOn: directDependencies,
        dependedOnBy: directDependents
      },
      removalRisks: {
        status: nodeId && directDependents.length ? "INFERRED" : "UNKNOWN",
        riskLevel: directDependents.length >= 5 ? "high" : directDependents.length > 0 ? "medium" : "low",
        details: directDependents.length
          ? [`${directDependents.length} recorded graph dependents would need review before removal.`]
          : ["No recorded dependent relationships were found for this node."]
      },
      recommendation: "Review the cited source path, graph edges, and commit history before changing this element."
    });
  }
});

// Endpoint: Ask AFTER (contextual repository Q&A)
aiRouter.post("/ask", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const {
    question,
    projectId,
    context: focusContext,
    history = [],
  } = req.body;

  const context = projectId ? await loadProjectContext(String(projectId), req.user!.uid) : null;
  if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "question is required" });
  }

  const projectContext: any = context.project;
  const timeline = context.timeline;
  const insights = context.insights;
  const graphNodes = context.graphNodes;
  const graphEdges = context.graphEdges;

  const requestedFocus = focusContext && typeof focusContext === "object"
    ? {
        type: focusContext.type,
        label: String(focusContext.label || ""),
        path: focusContext.path ? String(focusContext.path) : undefined,
      }
    : null;

  // The server resolves source content from the connected repository. The client
  // may identify the focus path, but cannot inject arbitrary source into the AI context.
  let normalizedFocus: any = requestedFocus;
  const token = resolveRequestGitHubToken(req);
  const parsedRepo = parseGitHubRepo(String(projectContext?.repository || ""));
  if (requestedFocus?.path && parsedRepo) {
    try {
      const ref = String(projectContext?.branch || projectContext?.defaultBranch || "");
      const url = `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/contents/${requestedFocus.path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`;
      const fileRes = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "AFTER-Software-Evolution-Platform",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (fileRes.ok) {
        const body: any = await fileRes.json();
        if (typeof body?.content === "string") {
          normalizedFocus = {
            ...requestedFocus,
            content: Buffer.from(body.content.replace(/\n/g, ""), "base64").toString("utf8").slice(0, 24000),
            sha: body.sha || null,
          };
        }
      }
    } catch (error: any) {
      console.warn("Could not resolve focused repository file:", error?.message);
    }
  }

  const focusedNode = normalizedFocus?.path
    ? graphNodes.find((node: any) => node.filePath === normalizedFocus.path)
    : null;

  const focusedNodeEdges = focusedNode
    ? graphEdges.filter((edge: any) => edge.from === focusedNode.id || edge.to === focusedNode.id)
    : [];

  const recentHistory = Array.isArray(history)
    ? history
        .filter((item: any) => item && (item.role === "user" || item.role === "assistant"))
        .slice(-10)
        .map((item: any) => ({
          role: item.role,
          content: String(item.content || "").slice(0, 4000),
        }))
    : [];

  const systemPrompt = `You are AFTER, an AI-native software intelligence assistant.
You are NOT a generic chatbot. You are the reasoning layer over a real software repository.

Your job is to answer engineering questions using the repository model, source code, graph relationships, history, insights, and the currently focused item.

Rules:
- NEVER invent repository facts, commits, files, dependencies, telemetry, rationale, or causal relationships.
- Prefer direct evidence over inference.
- Label important claims as KNOWN, INFERRED, or UNKNOWN.
- When the evidence is missing, say so plainly.
- The user may ask follow-up questions. Use the conversation history to maintain continuity.
- Treat the focused file/node as the primary context when one is provided.
- Do not claim code will break unless the available evidence supports that conclusion.
- When useful, cite concrete paths, SHAs, events, graph edges, or other provided evidence.
- Answer naturally like a technical assistant: conversational, clear, and useful, not as a rigid report.
- Markdown is allowed in the answer.

Return JSON only:
{
  "answer": "Direct conversational answer in markdown.",
  "citedEvidence": ["Concrete evidence item 1", "Concrete evidence item 2"],
  "suggestedInvestigation": ["Useful next investigation 1", "Useful next investigation 2"],
  "confidence": "high" | "medium" | "low"
}`;

  const focusNodeIds = new Set<string>(
    focusedNode
      ? [
          focusedNode.id,
          ...focusedNodeEdges.map((edge: any) => edge.from),
          ...focusedNodeEdges.map((edge: any) => edge.to),
        ]
      : []
  );

  const relevantGraphNodes = graphNodes
    .filter((node: any) => !focusNodeIds.size || focusNodeIds.has(node.id))
    .slice(0, 60);

  const relevantGraphNodeIds = new Set(relevantGraphNodes.map((node: any) => node.id));
  const relevantGraphEdges = graphEdges
    .filter((edge: any) => relevantGraphNodeIds.has(edge.from) || relevantGraphNodeIds.has(edge.to))
    .slice(0, 100);

  const focusTerms = [
    normalizedFocus?.label,
    normalizedFocus?.path,
    focusedNode?.label,
    ...(focusedNode?.filePath ? [focusedNode.filePath] : []),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  const relevanceScore = (value: any) => {
    const haystack = [
      value?.title,
      value?.summary,
      value?.event,
      value?.reason,
      ...(Array.isArray(value?.evidence) ? value.evidence : []),
      ...(Array.isArray(value?.affectedComponents) ? value.affectedComponents : []),
      ...(Array.isArray(value?.relatedFiles) ? value.relatedFiles : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return focusTerms.reduce((score, term) => score + (term && haystack.includes(term) ? 1 : 0), 0);
  };

  const relevantTimeline = [...(timeline || [])]
    .sort((a: any, b: any) => relevanceScore(b) - relevanceScore(a))
    .slice(0, 16);

  const relevantInsights = [...(insights || [])]
    .sort((a: any, b: any) => relevanceScore(b) - relevanceScore(a))
    .slice(0, 10);

  const relevantMemory = [...((context as any).memoryEntries || [])]
    .sort((a: any, b: any) => relevanceScore(b) - relevanceScore(a))
    .slice(0, 16);

  const projectContextForAI = {
    id: projectContext?.id,
    name: projectContext?.name,
    repository: projectContext?.repository,
    branch: projectContext?.branch,
    defaultBranch: projectContext?.defaultBranch,
    framework: projectContext?.framework,
    language: projectContext?.language,
  };

  const contextPayload = {
    project: projectContextForAI,
    focus: normalizedFocus ? {
      type: normalizedFocus.type,
      label: normalizedFocus.label,
      path: normalizedFocus.path,
      sha: normalizedFocus.sha,
      content: normalizedFocus.content ? String(normalizedFocus.content).slice(0, 24000) : undefined,
    } : null,
    focusGraphNode: focusedNode,
    focusRelationships: focusedNodeEdges.slice(0, 40),
    timelineEvents: relevantTimeline,
    activeInsights: relevantInsights,
    systemComponents: relevantGraphNodes,
    systemRelationships: relevantGraphEdges,
    softwareMemory: relevantMemory,
    conversationHistory: recentHistory,
  };

  const prompt = `User Question:
${question}

Repository intelligence context:
${JSON.stringify(contextPayload, null, 2)}

Answer the user's question using the repository evidence above. Keep the answer focused on what can actually be established.`;

  try {
    const rawText = await generateContentWithFallback({
      contents: prompt,
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.25,
    });

    const parsed = JSON.parse(rawText || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.warn("Gemini unavailable for /api/gemini/ask:", error?.message);

    const terms = String(question).toLowerCase().split(/\s+/).filter(Boolean);
    const relevantEvents = (timeline || []).filter((ev: any) => {
      const haystack = `${ev?.event || ""} ${ev?.reason || ""} ${ev?.metadata?.sha || ""}`.toLowerCase();
      return terms.some((term) => term.length > 3 && haystack.includes(term));
    }).slice(0, 3);

    const evidence = [
      normalizedFocus?.path ? `Focused source file: ${normalizedFocus.path}` : null,
      focusedNode?.filePath ? `Graph node mapped to ${focusedNode.filePath}` : null,
      ...relevantEvents.map((ev: any) => `Recorded event: ${ev.event} (${ev.timestamp})`),
    ].filter(Boolean) as string[];

    return res.json({
      answer: evidence.length
        ? `I could not reach the AI model right now. I can still ground this conversation in the repository evidence currently available.\\n\\n${evidence.map((item) => `- ${item}`).join("\\n")}\\n\\n**UNKNOWN:** no model-generated interpretation is available for this question yet.`
        : `I could not reach the AI model right now, and there is not enough matching repository evidence to answer this question safely.\\n\\n**UNKNOWN:** no grounded answer is available yet.`,
      citedEvidence: evidence,
      suggestedInvestigation: normalizedFocus?.path
        ? [`Inspect the focused file: ${normalizedFocus.path}`, "Open its graph relationships and file history."]
        : ["Inspect the Product Graph.", "Open the Timeline and repository history."],
      confidence: "low",
    });
  }
});

// Endpoint: Change Analysis (evidence extraction + AI interpretation)
aiRouter.post("/change-analysis", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { projectId, sha, path, pullRequestNumber, question } = req.body;
  const context = projectId ? await loadProjectContext(String(projectId), req.user!.uid) : null;
  if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });
  if (!sha && !path) return res.status(400).json({ error: "sha or path is required." });

  const project: any = context.project;
  const parsedRepo = parseGitHubRepo(String(project.repository || ""));
  if (!parsedRepo) return res.status(400).json({ error: "Project repository is not a valid GitHub repository." });

  const token = resolveRequestGitHubToken(req);
  const ghHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "AFTER-Software-Evolution-Platform",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    let subject: any = null;
    let files: any[] = [];
    let history: any[] = [];

    if (pullRequestNumber) {
      const prRes = await fetch(
        `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/pulls/${encodeURIComponent(String(pullRequestNumber))}`,
        { headers: ghHeaders }
      );
      if (!prRes.ok) {
        return res.status(prRes.status).json({ error: `GitHub pull request lookup failed (${prRes.status}).` });
      }

      subject = await prRes.json();
      for (let page = 1; page <= 3; page += 1) {
        const filesRes = await fetch(
          `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/pulls/${encodeURIComponent(String(pullRequestNumber))}/files?per_page=100&page=${page}`,
          { headers: ghHeaders }
        );
        if (!filesRes.ok) break;

        const pullFiles = await filesRes.json();
        if (!Array.isArray(pullFiles) || pullFiles.length === 0) break;

        files.push(...pullFiles.map((file: any) => ({
          path: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          patch: typeof file.patch === "string" ? file.patch.slice(0, 12000) : undefined,
        })));

        if (pullFiles.length < 100) break;
      }

      history = (context.timeline || []).filter((event: any) =>
        String(event?.metadata?.url || "").includes(`/pull/${pullRequestNumber}`) ||
        String(event?.metadata?.pullRequest || "") === String(pullRequestNumber)
      );
    } else if (sha) {
      const commitRes = await fetch(
        `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/commits/${encodeURIComponent(String(sha))}`,
        { headers: ghHeaders }
      );
      if (!commitRes.ok) return res.status(commitRes.status).json({ error: `GitHub commit lookup failed (${commitRes.status}).` });
      subject = await commitRes.json();
      files = Array.isArray(subject?.files)
        ? subject.files.map((file: any) => ({
            path: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            patch: typeof file.patch === "string" ? file.patch.slice(0, 12000) : undefined,
          }))
        : [];
      history = (context.timeline || []).filter((event: any) =>
        event?.metadata?.fullSha === sha ||
        event?.metadata?.sha === String(sha).slice(0, 7)
      );
    } else {
      const ref = String(project.branch || project.defaultBranch || "");
      const encodedPath = String(path).split("/").map(encodeURIComponent).join("/");
      const [fileRes, historyRes] = await Promise.all([
        fetch(
          `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
          { headers: ghHeaders }
        ),
        fetch(
          `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/commits?path=${encodeURIComponent(String(path))}&sha=${encodeURIComponent(ref)}&per_page=12`,
          { headers: ghHeaders }
        ),
      ]);
      if (!fileRes.ok) return res.status(fileRes.status).json({ error: `GitHub file lookup failed (${fileRes.status}).` });
      const file = await fileRes.json();
      if (historyRes.ok) history = await historyRes.json();

      subject = {
        path: String(path),
        sha: file?.sha || null,
        title: `File history: ${path}`,
      };
      files = [{
        path: String(path),
        status: "current",
        additions: undefined,
        deletions: undefined,
        patch: undefined,
      }];
    }

    const changedPaths = new Set<string>(files.map((file) => file.path).filter(Boolean));
    const directlyAffectedNodeIds = new Set<string>();

    for (const node of context.graphNodes || []) {
      if (node.filePath && changedPaths.has(node.filePath)) directlyAffectedNodeIds.add(node.id);
    }

    const affectedNodeIds = new Set<string>(directlyAffectedNodeIds);
    const impactQueue = [...directlyAffectedNodeIds];

    while (impactQueue.length && affectedNodeIds.size < 60) {
      const currentId = impactQueue.shift()!;
      for (const edge of context.graphEdges || []) {
        if (edge.to !== currentId) continue;
        if (affectedNodeIds.has(edge.from)) continue;
        affectedNodeIds.add(edge.from);
        impactQueue.push(edge.from);
        if (affectedNodeIds.size >= 60) break;
      }
    }

    const affectedNodes = (context.graphNodes || [])
      .filter((node: any) => affectedNodeIds.has(node.id))
      .map((node: any) => ({
        id: node.id,
        label: node.label,
        filePath: node.filePath,
        relationship: directlyAffectedNodeIds.has(node.id) ? "directly_changed" : "transitively_dependent",
      }));

    const relationshipEdges = (context.graphEdges || []).filter((edge: any) =>
      affectedNodeIds.has(edge.from) || affectedNodeIds.has(edge.to)
    );

    const potentialImpact = relationshipEdges.slice(0, 40).map((edge: any) => {
      const from = (context.graphNodes || []).find((node: any) => node.id === edge.from)?.label || edge.from;
      const to = (context.graphNodes || []).find((node: any) => node.id === edge.to)?.label || edge.to;
      return `${from} → ${to}${edge.label ? ` (${edge.label})` : ""}`;
    });

    const evidence = {
      subject: {
        type: pullRequestNumber ? "pull_request" : sha ? "commit" : "file",
        id: String(pullRequestNumber || sha || path),
        title: sha ? (subject?.commit?.message?.split("\n")[0] || `Commit ${sha}`) : subject.title,
      },
      commit: sha ? {
        sha: subject?.sha || sha,
        author: subject?.commit?.author?.name || subject?.author?.login || null,
        date: subject?.commit?.author?.date || subject?.commit?.committer?.date || null,
        url: subject?.html_url || null,
      } : null,
      pullRequest: pullRequestNumber ? {
        number: Number(pullRequestNumber),
        title: subject?.title || null,
        state: subject?.state || null,
        author: subject?.user?.login || subject?.user?.name || null,
        createdAt: subject?.created_at || null,
        updatedAt: subject?.updated_at || null,
        url: subject?.html_url || null,
      } : null,
      files,
      affectedNodes,
      relationships: relationshipEdges,
      history,
      question: typeof question === "string" ? question : null,
    };

    const systemPrompt = `You are AFTER's Change Analysis engine.
Analyze only the concrete change evidence supplied by the repository.
Never invent causality, regressions, metrics, or business rationale.
Distinguish KNOWN, INFERRED, and UNKNOWN.
Explain what changed, what repository nodes are directly mapped to the changed files, what graph relationships are involved, and what should be investigated next.
Return JSON:
{
  "summary": "Direct explanation",
  "known": ["Facts directly supported by the evidence"],
  "inferred": ["Carefully bounded deductions"],
  "unknown": ["Important questions the evidence cannot establish"],
  "potentialImpact": ["Potentially affected elements, phrased without certainty"],
  "nextInvestigations": ["Concrete follow-up investigation"],
  "confidence": "high" | "medium" | "low"
}`;

    const prompt = `Repository: ${project.repository}
Branch: ${project.branch || project.defaultBranch || "unknown"}
User question: ${question || "Analyze this change."}

Evidence:
${JSON.stringify(evidence, null, 2)}`;

    try {
      const rawText = await generateContentWithFallback({
        contents: prompt,
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.2,
      });
      const parsed = JSON.parse(rawText || "{}");
      return res.json({
        evidence,
        analysis: parsed,
      });
    } catch (aiError: any) {
      console.warn("Gemini unavailable for /api/gemini/change-analysis:", aiError?.message);
      return res.json({
        evidence,
        analysis: {
          summary: `The repository evidence for ${pullRequestNumber ? `pull request #${pullRequestNumber}` : sha ? `commit ${sha}` : `file ${path}`} is available, but an AI interpretation could not be generated.`,
          known: [
            ...files.slice(0, 12).map((file) =>
              `${file.path}: ${file.status || "changed"}${typeof file.additions === "number" ? `, +${file.additions}` : ""}${typeof file.deletions === "number" ? ` / -${file.deletions}` : ""}`
            ),
            ...affectedNodes.slice(0, 12).map((node: any) => `Mapped node: ${node.label}${node.filePath ? ` (${node.filePath})` : ""}`),
          ],
          inferred: potentialImpact.map((item: string) => `The recorded graph relationship may make this path relevant to the change: ${item}`),
          unknown: ["The available repository evidence does not establish runtime regression impact or original business rationale."],
          potentialImpact,
          nextInvestigations: [
            "Inspect the changed files and their direct dependents.",
            "Review the commit history and related pull request when available.",
          ],
          confidence: "low",
        },
      });
    }
  } catch (error: any) {
    console.warn("Change analysis failed:", error?.message);
    return res.status(500).json({ error: error?.message || "Change analysis failed." });
  }
});

// Endpoint: Analyze Insights (Continuous detection of anomalies, risks, cost & performance)
aiRouter.post("/analyze-insights", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { projectId } = req.body;
  const context = projectId ? await loadProjectContext(String(projectId), req.user!.uid) : null;
  if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });
  const project = context.project;
  const events = context.timeline;
  const components = context.graphNodes;

  // If there is no project or topology data, return empty results immediately
  if (!project || (!components?.length && !events?.length)) {
    return res.json({
      insights: [],
      summary: {
        anomaliesCount: 0,
        potentialRegressions: 0,
        estimatedMonthlyCostSavings: 0
      }
    });
  }

  const systemPrompt = `You are AFTER's continuous software intelligence scanner.
Analyze the project topology and change history to discover actionable insights.

Allowed categories:
["Bug risk", "Security", "Performance", "UX", "Cost", "Dependency", "Architecture", "Opportunity"]

Rules:
- Ground every insight in concrete technical evidence (e.g. orphaned endpoints, unpinned dependencies, cache missing, blocking calls).
- Do NOT fabricate fake numbers or hallucinate telemetry.
- Label impact: 'low' | 'medium' | 'high' | 'critical'.
- Label confidence: 'low' | 'medium' | 'high'.

Respond with JSON array:
{
  "insights": [
    {
      "title": "Concise headline",
      "description": "Thorough explanation of the issue or opportunity",
      "category": "Bug risk" | "Security" | "Performance" | "UX" | "Cost" | "Dependency" | "Architecture" | "Opportunity",
      "evidence": "Concrete technical evidence observed",
      "impact": "low" | "medium" | "high" | "critical",
      "confidence": "low" | "medium" | "high",
      "affectedComponents": ["ComponentA", "ComponentB"],
      "suggestedAction": "Concrete next step to resolve or exploit"
    }
  ],
  "summary": {
    "anomaliesCount": number,
    "potentialRegressions": number,
    "estimatedMonthlyCostSavings": number
  }
}`;

  const prompt = `Project:
${JSON.stringify(project || {}, null, 2)}

Recent Events:
${JSON.stringify(events || [], null, 2)}

System Components:
${JSON.stringify(components || [], null, 2)}

Perform a deep architectural and evolutionary scan.`;

  try {
    const rawText = await generateContentWithFallback({
      contents: prompt,
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.2,
    });

    const parsed = JSON.parse(rawText || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.warn("Gemini unavailable for /api/gemini/analyze-insights:", error?.message);

    // Strictly return empty insights on error without inventing synthetic data
    return res.json({
      insights: [],
      summary: {
        anomaliesCount: 0,
        potentialRegressions: 0,
        estimatedMonthlyCostSavings: 0
      }
    });
  }
});

// Endpoint: Structure Experiment
aiRouter.post("/structure-experiment", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { objective, projectId } = req.body;
  const context = projectId ? await loadProjectContext(String(projectId), req.user!.uid) : null;
  if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });
  const projectContext: any = context.project;

  if (!objective) {
    return res.status(400).json({ error: "objective is required" });
  }

  const systemPrompt = `You are AFTER's experiment designer.
Users propose product or architectural changes (e.g. "Migrate build system to Vite", "Adopt WebP image pipeline").
Structure this into a rigorous scientific experiment based strictly on real project context.

Always require explicit user confirmation before applying changes to production.

Respond with JSON:
{
  "title": "Clear experiment title",
  "hypothesis": "If [intervention], then [measurable effect], because [rationale].",
  "control": "Current baseline implementation",
  "variant": "Proposed experimental implementation",
  "metric": "Key measurable indicator (e.g. p95 TTFB, bundle size)",
  "expectedResult": "Anticipated quantifiable improvement",
  "risk": "Technical or UX regression risk assessment",
  "duration": "Recommended run duration (e.g. 7 days, 2 weeks)",
  "requiresProductionApproval": true
}`;

  const prompt = `Objective: "${objective}"
Project Context:
${JSON.stringify(projectContext || {}, null, 2)}`;

  try {
    const rawText = await generateContentWithFallback({
      contents: prompt,
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.2,
    });

    const parsed = JSON.parse(rawText || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.warn("Gemini unavailable for /api/gemini/structure-experiment:", error?.message);
    return res.status(503).json({
      error: "Experiment structuring is unavailable because the AI service did not return a grounded result.",
      status: "UNKNOWN"
    });
  }
});