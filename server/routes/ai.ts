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

// Endpoint: Ask AFTER (Q&A about project)
aiRouter.post("/ask", requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { question, projectId } = req.body;
  const context = projectId ? await loadProjectContext(String(projectId), req.user!.uid) : null;
  if (!context) return res.status(404).json({ error: "Project not found or not owned by the current user." });
  const projectContext: any = context.project;
  const timeline = context.timeline;
  const insights = context.insights;
  const graphNodes = context.graphNodes;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  const systemPrompt = `You are AFTER's Project Intelligence Assistant.
You answer engineering questions about software projects based on their real architecture, timeline changes, dependency records, and detected risks.

Style & Voice:
- Apple-grade clarity: direct, concise, mathematically and technically grounded.
- No buzzwords, no fluff, no generic AI optimism.
- Cite specific evidence from the project state when answering.
- Clarify whether points are KNOWN from recorded events, INFERRED from architecture, or UNKNOWN.

Format your response in JSON:
{
  "answer": "Clear markdown explanation directly answering the user's question.",
  "citedEvidence": [
    "Evidence item 1 (e.g. 'Dependency @stripe/stripe-js updated to v3.1 in Event #ev-04')",
    "Evidence item 2"
  ],
  "suggestedInvestigation": [
    "Investigation step 1",
    "Investigation step 2"
  ],
  "confidence": "high" | "medium" | "low"
}`;

  const contextPayload = {
    project: projectContext || {},
    timelineEvents: timeline || [],
    activeInsights: insights || [],
    systemComponents: graphNodes || [],
  };

  const prompt = `User Question: "${question}"

Current Project Data & History:
${JSON.stringify(contextPayload, null, 2)}`;

  try {
    const rawText = await generateContentWithFallback({
      contents: prompt,
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    const parsed = JSON.parse(rawText || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.warn("Gemini unavailable for /api/gemini/ask, synthesizing context answer:", error?.message);

    const relevantEvent = (timeline || []).find((ev: any) =>
      ev?.event?.toLowerCase().includes(String(question).toLowerCase()) ||
      ev?.reason?.toLowerCase().includes(String(question).toLowerCase())
    );

    return res.json({
      answer: relevantEvent
        ? `Observed recorded event: "${relevantEvent.event}" (${relevantEvent.timestamp}) by ${relevantEvent.actor}: "${relevantEvent.reason}".`
        : `No matching records or telemetry found in the ledger for "${question}".`,
      citedEvidence: relevantEvent
        ? [`Recorded activity: ${relevantEvent.event} (${relevantEvent.timestamp})`]
        : [],
      suggestedInvestigation: [
        "Inspect the Product Graph to verify dependent component connectivity.",
        "Check Timeline for recorded commit history."
      ],
      confidence: "low"
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
