import { Router } from "express";
import { generateContentWithFallback } from "../gemini.js";
import { requireFirebaseUser, type AuthenticatedRequest } from "../auth.js";
import { loadProjectContext } from "../projectContext.js";

export const aiRouter = Router();

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

Dependencies:
${JSON.stringify(dependencies || [], null, 2)}

Explain WHY "${nodeName}" exists and analyze its architectural impact.`;

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

    const node = context.graphNodes.find((item: any) =>
      item?.id === nodeName || item?.label?.toLowerCase() === String(nodeName).toLowerCase()
    );
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

  const normalizedFocus = focusContext && typeof focusContext === "object"
    ? {
        type: focusContext.type,
        label: focusContext.label,
        path: focusContext.path,
        content: typeof focusContext.content === "string"
          ? focusContext.content.slice(0, 24000)
          : undefined,
      }
    : null;

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

  const contextPayload = {
    project: projectContext || {},
    focus: normalizedFocus,
    focusGraphNode: focusedNode || null,
    focusRelationships: focusedNodeEdges,
    timelineEvents: timeline || [],
    activeInsights: insights || [],
    systemComponents: graphNodes || [],
    systemRelationships: graphEdges || [],
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
