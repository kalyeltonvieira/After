import React from "react";
import { Download, FileText, Printer } from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useLanguage } from "../context/LanguageContext";

export function ExecutiveReportPage() {
  const { currentProject } = useProject();
  const { language } = useLanguage();
  const isPt = language === "pt";

  const nodes = currentProject?.graphNodes || [];
  const edges = currentProject?.graphEdges || [];
  const events = currentProject?.events || [];
  const insights = currentProject?.insights || [];
  const memory = currentProject?.memoryEntries || [];
  const generatedAt = new Date().toISOString();

  const report = currentProject ? {
    reportType: "AFTER_EXECUTIVE_SOFTWARE_INTEGRITY_REPORT",
    schemaVersion: 1,
    generatedAt,
    project: {
      id: currentProject.id,
      name: currentProject.name,
      repository: currentProject.repository,
      branch: currentProject.branch,
      defaultBranch: currentProject.defaultBranch || null,
      language: currentProject.language || null,
      framework: currentProject.framework || null,
      githubConnected: Boolean(currentProject.githubConnected),
      analysisStatus: currentProject.analysisStatus || "unknown",
      stars: typeof currentProject.stars === "number" ? currentProject.stars : null,
      openIssues: typeof currentProject.openIssues === "number" ? currentProject.openIssues : null,
      createdAt: currentProject.createdAt,
      updatedAt: currentProject.updatedAt,
    },
    architecture: {
      graphNodeCount: nodes.length,
      graphEdgeCount: edges.length,
      dependencyEdgeCount: edges.filter((edge) => /import|depend/i.test(edge.label || "")).length,
      nodeTypes: nodes.reduce<Record<string, number>>((counts, node) => {
        counts[node.type] = (counts[node.type] || 0) + 1;
        return counts;
      }, {}),
      nodes,
      edges,
    },
    observations: {
      eventCount: events.length,
      events,
      insightCount: insights.length,
      insights,
    },
    softwareMemory: {
      entryCount: memory.length,
      known: memory.filter((entry) => entry.status === "KNOWN").length,
      inferred: memory.filter((entry) => entry.status === "INFERRED").length,
      unknown: memory.filter((entry) => entry.status === "UNKNOWN").length,
      entries: memory,
    },
    integrityNotes: [
      "This report contains only information currently persisted in AFTER for this project.",
      "Missing source data is represented as null or an empty collection; no estimates are fabricated.",
      "An empty finding list does not prove the repository is free of vulnerabilities.",
    ],
  } : null;

  const exportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `after-integrity-report-${currentProject?.id || "project"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const known = memory.filter((entry) => entry.status === "KNOWN").length;
  const inferred = memory.filter((entry) => entry.status === "INFERRED").length;
  const unknown = memory.filter((entry) => entry.status === "UNKNOWN").length;
  const securityFindings = insights.filter((insight) => /security/i.test(insight.category));

  if (!currentProject) {
    return <div className="mx-auto max-w-5xl p-8 text-sm text-zinc-500">{isPt ? "Selecione um projeto para gerar o relatório executivo." : "Select a project to generate its executive report."}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-400"><FileText className="h-3.5 w-3.5" /> AFTER / EXECUTIVE REPORT</div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{isPt ? "Relatório de Integridade do Software" : "Software Integrity Report"}</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{currentProject.repository} · {currentProject.branch}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"><Printer className="h-3.5 w-3.5" /> {isPt ? "Imprimir / PDF" : "Print / PDF"}</button>
          <button type="button" onClick={exportJson} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"><Download className="h-3.5 w-3.5" /> JSON</button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [isPt ? "Nós arquiteturais" : "Architecture nodes", nodes.length],
          [isPt ? "Relacionamentos" : "Relationships", edges.length],
          [isPt ? "Insights registrados" : "Recorded insights", insights.length],
          [isPt ? "Eventos observados" : "Observed events", events.length],
        ].map(([label, value]) => <div key={String(label)} className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"><p className="font-mono text-2xl tabular-nums text-zinc-950 dark:text-zinc-50">{value}</p><p className="mt-1 text-[10px] text-zinc-500">{label}</p></div>)}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{isPt ? "Identidade do projeto" : "Project identity"}</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <div><dt className="text-[10px] text-zinc-400">{isPt ? "Repositório" : "Repository"}</dt><dd className="mt-1 break-all font-mono text-zinc-800 dark:text-zinc-200">{currentProject.repository}</dd></div>
          <div><dt className="text-[10px] text-zinc-400">{isPt ? "Branch" : "Branch"}</dt><dd className="mt-1 font-mono text-zinc-800 dark:text-zinc-200">{currentProject.branch}</dd></div>
          <div><dt className="text-[10px] text-zinc-400">{isPt ? "Linguagem / Framework" : "Language / Framework"}</dt><dd className="mt-1 text-zinc-800 dark:text-zinc-200">{currentProject.language || "—"} / {currentProject.framework || "—"}</dd></div>
          <div><dt className="text-[10px] text-zinc-400">{isPt ? "Status da análise" : "Analysis status"}</dt><dd className="mt-1 text-zinc-800 dark:text-zinc-200">{currentProject.analysisStatus || (currentProject.githubConnected ? "connected (legacy status)" : "unknown")}</dd></div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{isPt ? "Integridade do conhecimento" : "Knowledge integrity"}</h2>
        <p className="mt-1 text-[10px] text-zinc-500">{isPt ? "Classificação das entradas de Software Memory, conforme persistidas." : "Classification of persisted Software Memory entries."}</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div><p className="font-mono text-xl text-emerald-600">{known}</p><p className="text-[10px] text-zinc-500">KNOWN</p></div>
          <div><p className="font-mono text-xl text-amber-600">{inferred}</p><p className="text-[10px] text-zinc-500">INFERRED</p></div>
          <div><p className="font-mono text-xl text-zinc-500">{unknown}</p><p className="text-[10px] text-zinc-500">UNKNOWN</p></div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{isPt ? "Insights e postura de segurança" : "Insights and security posture"}</h2>
        <p className="mt-1 text-[10px] text-zinc-500">{isPt ? "Itens explicitamente categorizados como segurança: " : "Items explicitly categorized as security: "}{securityFindings.length}</p>
        {insights.length === 0 ? <p className="mt-4 text-xs text-zinc-500">{isPt ? "Nenhum insight foi persistido para este projeto." : "No insights are currently persisted for this project."}</p> : (
          <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {insights.map((insight) => <article key={insight.id} className="py-3 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{insight.title}</h3><span className="text-[9px] font-mono uppercase text-zinc-500">{insight.category} · {insight.impact} · {insight.confidence}</span></div><p className="mt-1 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">{insight.description}</p><p className="mt-1 text-[10px] text-zinc-400">{isPt ? "Evidência: " : "Evidence: "}{insight.evidence || (isPt ? "não informada" : "not provided")}</p></article>)}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{isPt ? "Registro de memória técnica" : "Technical memory ledger"}</h2>
        {memory.length === 0 ? <p className="mt-3 text-xs text-zinc-500">{isPt ? "Nenhuma entrada de memória persistida." : "No persisted memory entries."}</p> : (
          <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {memory.slice(0, 100).map((entry) => <article key={entry.id} className="py-3 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{entry.title}</h3><span className="font-mono text-[9px] text-zinc-400">{entry.status} · {entry.type}</span></div><p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">{entry.summary}</p><p className="mt-1 break-words text-[10px] text-zinc-400">{(entry.evidence || []).join(" · ")}</p></article>)}
            {memory.length > 100 && <p className="py-3 text-[10px] text-zinc-400">{isPt ? "O documento JSON contém a coleção completa; a visualização imprime as primeiras 100 entradas." : "The JSON export contains the complete collection; this view prints the first 100 entries."}</p>}
          </div>
        )}
      </section>

      <footer className="border-t border-zinc-200 pt-3 text-[10px] text-zinc-400 dark:border-zinc-800">
        {isPt ? "Relatório gerado a partir dos dados disponíveis no AFTER em " : "Report generated from data available in AFTER at "}{new Date(generatedAt).toLocaleString(isPt ? "pt-BR" : "en-US")}. {isPt ? "Ausência de achados não prova ausência de vulnerabilidades." : "Absence of findings does not prove absence of vulnerabilities."}
      </footer>
    </div>
  );
}
