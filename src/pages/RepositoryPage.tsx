import React, { useEffect, useMemo, useState } from "react";
import {
  GitBranch, FileCode2, GitCommit, GitPullRequest, CircleDot, Package, Users,
  Search, Plus, Eye, ExternalLink, RefreshCw, Sparkles, X, Tag, Activity,
  Copy, Check, GitCompare, MessageSquare, Save, ChevronRight, Clock3,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { authenticatedHeaders } from "../lib/api";
import { EmptyState } from "../components/EmptyState";

type Tab = "code" | "branches" | "commits" | "pulls" | "issues" | "releases" | "tags" | "contributors" | "activity";

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function highlightLine(line: string, language: string) {
  const tokenPattern = /(\/\/.*$|#.*$)|([\"'`][^\"'`]*[\"'`])|(\b(?:const|let|var|function|return|import|from|export|default|class|if|else|for|while|async|await|new|throw|try|catch|interface|type|extends|implements|public|private|protected|def|func|fn|pub|struct|impl|package|use)\b)|(\b\d+(?:\.\d+)?\b)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(line.slice(last, index));
    const value = match[0];
    const tokenClass = match[1]
      ? "text-zinc-500"
      : match[2]
      ? "text-amber-300"
      : match[3]
      ? "text-sky-300"
      : "text-fuchsia-300";
    nodes.push(<span key={`${index}-${language}`} className={tokenClass}>{value}</span>);
    last = index + value.length;
  }
  if (last < line.length) nodes.push(line.slice(last));
  return nodes.length ? nodes : line || " ";
}

function languageFromPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "tsx" || ext === "jsx") return "typescript-react";
  if (ext === "ts") return "typescript";
  if (ext === "js" || ext === "mjs" || ext === "cjs") return "javascript";
  if (ext === "py") return "python";
  if (ext === "go") return "go";
  if (ext === "rs") return "rust";
  if (ext === "json") return "json";
  if (ext === "css") return "css";
  return ext || "text";
}

export function RepositoryPage() {
  const { currentProject, setAiContext, setIsAskAfterOpen, updateCurrentProject, graphNodes, graphEdges } = useProject();
  const [tab, setTab] = useState<Tab>("code");
  const [data, setData] = useState<any>({});
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [compareBase, setCompareBase] = useState("");
  const [compareHead, setCompareHead] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [changeAnalysis, setChangeAnalysis] = useState<any>(null);
  const [changeAnalysisLoading, setChangeAnalysisLoading] = useState(false);
  const [issueDetail, setIssueDetail] = useState<any>(null);
  const [issueComment, setIssueComment] = useState("");
  const [issueSaving, setIssueSaving] = useState(false);
  const [issueDraft, setIssueDraft] = useState({ title: "", body: "", labels: "", assignees: "", milestone: "" });
  const [pullDetail, setPullDetail] = useState<any>(null);
  const [pullComment, setPullComment] = useState("");
  const [pullSaving, setPullSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const projectId = currentProject?.id;
  const tabs = useMemo(() => [
    ["code", FileCode2, "Code"],
    ["branches", GitBranch, "Branches"],
    ["commits", GitCommit, "Commits"],
    ["pulls", GitPullRequest, "Pull Requests"],
    ["issues", CircleDot, "Issues"],
    ["releases", Package, "Releases"],
    ["tags", Tag, "Tags"],
    ["contributors", Users, "Contributors"],
    ["activity", Activity, "Activity"],
  ] as const, []);

  const request = async (path: string, init?: RequestInit) => {
    const res = await fetch(path, { ...init, headers: { ...(await authenticatedHeaders()), ...(init?.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  };

  const loadBranches = async () => {
    if (!projectId) return;
    try {
      const body = await request(`/api/repository/branches?projectId=${encodeURIComponent(projectId)}&per_page=100`);
      const next = Array.isArray(body.branches) ? body.branches : [];
      setBranches(next);
      if (!compareBase) setCompareBase(currentProject?.defaultBranch || currentProject?.branch || next[0]?.name || "");
      if (!compareHead) setCompareHead(currentProject?.branch || next[1]?.name || next[0]?.name || "");
    } catch (error) {
      setData((prev: any) => ({ ...prev, error: error instanceof Error ? error.message : String(error) }));
    }
  };

  const loadTab = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const q = encodeURIComponent(projectId);
      if (tab === "code") setData((await request(`/api/repository/tree?projectId=${q}`)));
      if (tab === "branches") setData((await request(`/api/repository/branches?projectId=${q}&per_page=100`)));
      if (tab === "commits") setData((await request(`/api/repository/commits?projectId=${q}&per_page=50`)));
      if (tab === "pulls") setData((await request(`/api/repository/pulls?projectId=${q}&state=all&per_page=50`)));
      if (tab === "issues") setData((await request(`/api/repository/issues?projectId=${q}&state=all&per_page=50`)));
      if (tab === "releases") setData((await request(`/api/repository/releases?projectId=${q}&per_page=50`)));
      if (tab === "tags") setData((await request(`/api/repository/tags?projectId=${q}&per_page=100`)));
      if (tab === "contributors") setData((await request(`/api/repository/contributors?projectId=${q}&per_page=50`)));
      if (tab === "activity") setData((await request(`/api/repository/activity?projectId=${q}&per_page=25`)));
    } catch (error) {
      setData({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTab();
    setSelectedFile(null);
    setSearch("");
  }, [projectId, tab]);

  useEffect(() => {
    void loadBranches();
  }, [projectId, currentProject?.defaultBranch, currentProject?.branch]);

  if (!currentProject) {
    return <div className="p-8 max-w-4xl mx-auto"><EmptyState title="No repository connected" description="Connect a GitHub repository to browse its real code and history." /></div>;
  }

  const openFile = async (path: string) => {
    setSelectedFile(path);
    try {
      const [file, history] = await Promise.all([
        request(`/api/repository/file?projectId=${encodeURIComponent(projectId!)}&path=${encodeURIComponent(path)}&ref=${encodeURIComponent(currentProject.branch)}`),
        request(`/api/repository/file-history?projectId=${encodeURIComponent(projectId!)}&path=${encodeURIComponent(path)}&ref=${encodeURIComponent(currentProject.branch)}&per_page=12`),
      ]);
      setData((prev: any) => ({ ...prev, file, fileHistory: history.commits || [] }));
      setAiContext({
        type: "file",
        label: path,
        path,
        content: typeof file.content === "string" ? file.content.slice(0, 24000) : undefined,
      });
    } catch (error) {
      setData((prev: any) => ({ ...prev, file: null, error: error instanceof Error ? error.message : String(error) }));
    }
  };

  const switchBranch = async (branch: string) => {
    if (!branch || branch === currentProject.branch) return;
    try {
      await updateCurrentProject({ branch });
      setData({});
      setSelectedFile(null);
      setTab("code");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const createBranch = async () => {
    const name = window.prompt("New branch name");
    if (!name) return;
    try {
      await request("/api/repository/branches", {
        method: "POST",
        body: JSON.stringify({ projectId, name, from: currentProject.branch || currentProject.defaultBranch }),
      });
      await loadBranches();
      if (tab === "branches") await loadTab();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const compareBranches = async () => {
    if (!compareBase || !compareHead || compareBase === compareHead) return;
    setCompareLoading(true);
    try {
      setData((await request(`/api/repository/compare?projectId=${encodeURIComponent(projectId!)}&base=${encodeURIComponent(compareBase)}&head=${encodeURIComponent(compareHead)}`)));
    } catch (error) {
      setData({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setCompareLoading(false);
    }
  };

  const toggleWatch = async () => {
    try {
      const existing = await request(`/api/repository/watch?projectId=${encodeURIComponent(projectId!)}`);
      const watching = Array.isArray(existing.watchTargets) && existing.watchTargets.length > 0;
      await request("/api/repository/watch", {
        method: "POST",
        body: JSON.stringify({ projectId, enabled: !watching }),
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const createIssue = async () => {
    const title = window.prompt("Issue title");
    if (!title) return;
    const body = window.prompt("Issue description") || "";
    try {
      await request("/api/repository/issues", { method: "POST", body: JSON.stringify({ projectId, title, body }) });
      await loadTab();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const openIssue = async (number: number) => {
    try {
      const detail = await request(`/api/repository/issues/${number}?projectId=${encodeURIComponent(projectId!)}`);
      setIssueDetail(detail);
      const issue = detail.issue || {};
      setIssueDraft({
        title: issue.title || "",
        body: issue.body || "",
        labels: Array.isArray(issue.labels) ? issue.labels.map((label: any) => label.name).join(", ") : "",
        assignees: Array.isArray(issue.assignees) ? issue.assignees.map((user: any) => user.login).join(", ") : "",
        milestone: issue.milestone?.number != null ? String(issue.milestone.number) : "",
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const saveIssue = async () => {
    if (!issueDetail?.issue?.number) return;
    setIssueSaving(true);
    try {
      const labels = issueDraft.labels.split(",").map((v) => v.trim()).filter(Boolean);
      const assignees = issueDraft.assignees.split(",").map((v) => v.trim()).filter(Boolean);
      const body = await request(`/api/repository/issues/${issueDetail.issue.number}`, {
        method: "PATCH",
        body: JSON.stringify({
          projectId,
          title: issueDraft.title,
          body: issueDraft.body,
          labels,
          assignees,
          milestone: issueDraft.milestone ? Number(issueDraft.milestone) : null,
        }),
      });
      setIssueDetail((prev: any) => ({ ...prev, issue: body.issue }));
      await loadTab();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setIssueSaving(false);
    }
  };

  const toggleIssueState = async () => {
    if (!issueDetail?.issue?.number) return;
    setIssueSaving(true);
    try {
      const nextState = issueDetail.issue.state === "open" ? "closed" : "open";
      const body = await request(`/api/repository/issues/${issueDetail.issue.number}`, {
        method: "PATCH",
        body: JSON.stringify({ projectId, state: nextState }),
      });
      setIssueDetail((prev: any) => ({ ...prev, issue: body.issue }));
      await loadTab();
    } finally {
      setIssueSaving(false);
    }
  };

  const postIssueComment = async () => {
    if (!issueDetail?.issue?.number || !issueComment.trim()) return;
    setIssueSaving(true);
    try {
      await request(`/api/repository/issues/${issueDetail.issue.number}/comments`, {
        method: "POST",
        body: JSON.stringify({ projectId, body: issueComment.trim() }),
      });
      setIssueComment("");
      const refreshed = await request(`/api/repository/issues/${issueDetail.issue.number}?projectId=${encodeURIComponent(projectId!)}`);
      setIssueDetail(refreshed);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setIssueSaving(false);
    }
  };

  const openPull = async (number: number) => {
    try {
      setPullDetail(await request(`/api/repository/pulls/${number}?projectId=${encodeURIComponent(projectId!)}`));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const togglePullState = async () => {
    if (!pullDetail?.pull?.number) return;
    setPullSaving(true);
    try {
      const nextState = pullDetail.pull.state === "open" ? "closed" : "open";
      const body = await request(`/api/repository/pulls/${pullDetail.pull.number}`, {
        method: "PATCH",
        body: JSON.stringify({ projectId, state: nextState }),
      });
      setPullDetail((prev: any) => ({ ...prev, pull: body.pull }));
      await loadTab();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setPullSaving(false);
    }
  };

  const postPullComment = async () => {
    if (!pullDetail?.pull?.number || !pullComment.trim()) return;
    setPullSaving(true);
    try {
      await request(`/api/repository/pulls/${pullDetail.pull.number}/comments`, {
        method: "POST",
        body: JSON.stringify({ projectId, body: pullComment.trim() }),
      });
      setPullComment("");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setPullSaving(false);
    }
  };

  const analyzeChange = async (payload: Record<string, any>) => {
    setChangeAnalysisLoading(true);
    setChangeAnalysis(null);
    try {
      setChangeAnalysis(await request("/api/gemini/change-analysis", {
        method: "POST",
        body: JSON.stringify({ projectId, ...payload }),
      }));
    } catch (error) {
      setChangeAnalysis({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setChangeAnalysisLoading(false);
    }
  };

  const copyFile = async () => {
    const value = data.file?.content;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const tree = (data.tree || [])
    .filter((item: any) => item.type === "blob" && String(item.path).toLowerCase().includes(search.toLowerCase()))
    .slice(0, 400);
  const filteredBranches = branches.filter((b) => String(b.name).toLowerCase().includes(branchSearch.toLowerCase()));
  const commits = data.commits || [];
  const pulls = data.pulls || [];
  const issues = data.issues || [];
  const releases = data.releases || [];
  const tags = data.tags || [];
  const contributors = data.contributors || [];
  const activity = data.events || [];
  const lineCount = String(data.file?.content || "").split("\n").length;
  const selectedNodeIds = useMemo(
    () => new Set((graphNodes || []).filter((node: any) => node.filePath === data.file?.path).map((node: any) => node.id)),
    [graphNodes, data.file?.path]
  );
  const fileSymbols = useMemo(
    () => (graphNodes || []).filter((node: any) => node.filePath === data.file?.path && node.symbol && node.parentId).slice(0, 40),
    [graphNodes, data.file?.path]
  );
  const fileDependencies = useMemo(
    () => (graphEdges || [])
      .filter((edge: any) => selectedNodeIds.has(edge.from) && edge.label === "imports")
      .map((edge: any) => (graphNodes || []).find((node: any) => node.id === edge.to))
      .filter(Boolean),
    [graphEdges, graphNodes, selectedNodeIds]
  );
  const fileDependents = useMemo(
    () => (graphEdges || [])
      .filter((edge: any) => selectedNodeIds.has(edge.to) && edge.label === "imports")
      .map((edge: any) => (graphNodes || []).find((node: any) => node.id === edge.from))
      .filter(Boolean),
    [graphEdges, graphNodes, selectedNodeIds]
  );
  const compare = data.compare;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 border-b border-zinc-200/70 dark:border-zinc-800 pb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono">Repository</div>
            <h1 className="text-2xl font-semibold tracking-tight truncate">{currentProject.repository}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-[10px] font-mono">
                <GitBranch className="w-3 h-3 text-zinc-400" />
                <select value={currentProject.branch} onChange={(e) => void switchBranch(e.target.value)} className="bg-transparent outline-none cursor-pointer">
                  {branches.length === 0 && <option value={currentProject.branch}>{currentProject.branch}</option>}
                  {branches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <span className="text-xs text-zinc-500">{currentProject.language}</span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="text-xs text-zinc-500">{currentProject.framework}</span>
              {currentProject.defaultBranch && <span className="text-[10px] text-zinc-400">default: {currentProject.defaultBranch}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleWatch} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
              <Eye className="w-3.5 h-3.5" /> Watch
            </button>
            <button onClick={loadTab} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <a href={`https://github.com/${currentProject.repository}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs">
              GitHub <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {tabs.map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${tab === id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {data.error && <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs">{data.error}</div>}
      {loading && <div className="py-10 text-center text-xs text-zinc-400">Loading real repository data…</div>}

      {!loading && tab === "code" && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,360px)_1fr] gap-4">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files…" className="bg-transparent outline-none text-xs flex-1" />
              <span className="text-[10px] text-zinc-400">{tree.length}</span>
            </div>
            <div className="max-h-[70vh] overflow-auto p-2">
              {tree.map((item: any) => (
                <button key={item.path} onClick={() => void openFile(item.path)} className={`w-full text-left px-3 py-2 rounded-lg font-mono text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800 ${selectedFile === item.path ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}>
                  {item.path}
                </button>
              ))}
              {tree.length === 0 && <p className="p-6 text-center text-xs text-zinc-400">No source file matched.</p>}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs truncate">{data.file?.path || "Select a file"}</div>
                  {data.file?.path && (
                    <>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {data.file.path.split("/").map((part: string, index: number) => <React.Fragment key={`${part}-${index}`}><span className="font-mono text-[10px] text-zinc-500">{part}</span>{index < data.file.path.split("/").length - 1 && <ChevronRight className="w-3 h-3 text-zinc-600" />}</React.Fragment>)}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1">{languageFromPath(data.file.path)} · {lineCount} lines · {data.file.size ?? "?"} bytes</div>
                    </>
                  )}
                </div>
                {data.file?.path && (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => void copyFile()} className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px]">
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
                    </button>
                    <button type="button" onClick={() => void analyzeChange({ path: data.file.path, question: "Analyze this file's current repository state, recent history, related graph relationships, and potential impact of changing it." })} className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px]">
                      <Sparkles className="w-3 h-3" /> Analyze
                    </button>
                    <button type="button" onClick={() => setIsAskAfterOpen(true)} className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[11px] font-medium">
                      Ask AFTER
                    </button>
                  </div>
                )}
              </div>
              <div className="max-h-[62vh] overflow-auto bg-zinc-950">
                {data.file?.content ? (
                  <div className="min-w-max font-mono text-[11px] leading-relaxed text-zinc-100">
                    {data.file.content.split("\n").map((line: string, index: number) => (
                      <div key={index} id={`code-line-${index + 1}`} className="flex scroll-mt-24">
                        <span className="select-none w-12 shrink-0 text-right pr-3 text-zinc-600">{index + 1}</span>
                        <code className="whitespace-pre px-3">{highlightLine(line, languageFromPath(data.file.path))}</code>
                      </div>
                    ))}
                  </div>
                ) : <div className="p-8 text-xs text-zinc-500">No file selected.</div>}
              </div>
            </div>

            {data.file?.path && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Symbols</div>
                  <div className="mt-2 space-y-1 max-h-36 overflow-auto">
                    {fileSymbols.length ? fileSymbols.map((symbol: any) => (
                      <button key={symbol.id} type="button" onClick={() => document.getElementById(`code-line-${symbol.line || 1}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="w-full text-left rounded-lg px-2 py-1 text-[10px] font-mono hover:bg-zinc-100 dark:hover:bg-zinc-900">
                        {symbol.symbol} <span className="text-zinc-400">L{symbol.line || 1}</span>
                      </button>
                    )) : <div className="text-xs text-zinc-400">No symbol-level evidence for this file.</div>}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Dependencies</div>
                  <div className="mt-2 space-y-1 max-h-36 overflow-auto">
                    {fileDependencies.length ? fileDependencies.map((node: any) => <button key={node.id} type="button" onClick={() => setAiContext({ type: "node", label: node.label, path: node.filePath })} className="w-full text-left rounded-lg px-2 py-1 text-[10px] font-mono hover:bg-zinc-100 dark:hover:bg-zinc-900 truncate">{node.label}</button>) : <div className="text-xs text-zinc-400">No recorded import relationship.</div>}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Dependents</div>
                  <div className="mt-2 space-y-1 max-h-36 overflow-auto">
                    {fileDependents.length ? fileDependents.map((node: any) => <button key={node.id} type="button" onClick={() => setAiContext({ type: "node", label: node.label, path: node.filePath })} className="w-full text-left rounded-lg px-2 py-1 text-[10px] font-mono hover:bg-zinc-100 dark:hover:bg-zinc-900 truncate">{node.label}</button>) : <div className="text-xs text-zinc-400">No recorded dependent relationship.</div>}
                  </div>
                </div>
              </div>
            )}

            {data.fileHistory?.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold"><Clock3 className="w-3.5 h-3.5" /> File history</div>
                <div className="mt-3 space-y-2">
                  {data.fileHistory.map((commit: any) => (
                    <button key={commit.sha} type="button" onClick={() => void analyzeChange({ sha: commit.sha, question: "Explain what this commit changed in relation to the selected file and what should be investigated next." })} className="w-full text-left rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <div className="text-xs font-medium">{commit.commit?.message?.split("\n")[0] || commit.sha}</div>
                      <div className="mt-1 text-[10px] text-zinc-400">{commit.commit?.author?.name || commit.author?.login || "Unknown"} · {formatDate(commit.commit?.author?.date || commit.commit?.committer?.date)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && tab === "branches" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => void createBranch()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs"><Plus className="w-3.5 h-3.5" /> Create branch</button>
              <div className="relative"><Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-400" /><input value={branchSearch} onChange={(e) => setBranchSearch(e.target.value)} placeholder="Filter branches" className="pl-8 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs" /></div>
            </div>
            <div className="text-[11px] text-zinc-400">{filteredBranches.length} branches visible</div>
          </div>
          <div className="grid gap-2">
            {filteredBranches.map((b: any) => (
              <div key={b.name} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0"><div className="font-mono text-sm truncate">{b.name}</div><div className="text-[10px] text-zinc-400 mt-1">{b.protected ? "Protected" : "Unprotected"} · {b.commit?.sha?.slice(0, 10)}</div></div>
                <button type="button" onClick={() => void switchBranch(b.name)} className={`px-3 py-1.5 rounded-lg text-[11px] ${currentProject.branch === b.name ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400" : "border border-zinc-200 dark:border-zinc-700"}`}>{currentProject.branch === b.name ? "Current" : "Switch"}</button>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><GitCompare className="w-4 h-4" /> Compare branches</div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
              <select value={compareBase} onChange={(e) => setCompareBase(e.target.value)} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-xs">{branches.map((b) => <option key={`base-${b.name}`} value={b.name}>{b.name}</option>)}</select>
              <select value={compareHead} onChange={(e) => setCompareHead(e.target.value)} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-xs">{branches.map((b) => <option key={`head-${b.name}`} value={b.name}>{b.name}</option>)}</select>
              <button type="button" disabled={compareLoading || !compareBase || !compareHead || compareBase === compareHead} onClick={() => void compareBranches()} className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs disabled:opacity-40">{compareLoading ? "Comparing…" : "Compare"}</button>
            </div>
            {compare && (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 p-3 text-xs">
                <div className="font-medium">{compare.base?.label || compareBase} → {compare.head?.label || compareHead}</div>
                <div className="mt-1 text-zinc-400">{compare.total_commits ?? 0} commits · {compare.files?.length ?? 0} files · {compare.status || "unknown"}</div>
                <div className="mt-3 space-y-1">{(compare.files || []).slice(0, 15).map((file: any) => <div key={file.filename} className="font-mono text-[10px]">{file.filename} · +{file.additions || 0} / -{file.deletions || 0}</div>)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && tab === "commits" && (
        <div className="space-y-3">
          {commits.map((c: any) => (
            <div key={c.sha} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><button type="button" onClick={() => void analyzeChange({ sha: c.sha, question: "Analyze what changed in this commit, what it affects, and what I should investigate next." })} className="text-left font-medium text-sm hover:underline">{c.commit?.message?.split("\n")[0]}</button><div className="mt-2 text-[11px] text-zinc-400">{c.commit?.author?.name || c.author?.login} · {formatDate(c.commit?.author?.date || c.commit?.committer?.date)}</div></div>
                <div className="text-right shrink-0"><div className="font-mono text-[10px] text-zinc-400">{c.sha?.slice(0, 8)}</div><a className="mt-1 inline-block text-[10px] text-zinc-400 hover:text-zinc-900 dark:hover:text-white" href={c.html_url} target="_blank" rel="noreferrer">GitHub</a></div>
              </div>
            </div>
          ))}
          {commits.length === 0 && <EmptyState title="No commits returned" description="GitHub did not return commits for this branch." />}
        </div>
      )}

      {!loading && tab === "pulls" && (
        <div className="space-y-3">
          <button onClick={createPull} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs"><Plus className="w-3.5 h-3.5" /> Open pull request</button>
          {pulls.map((p: any) => (
            <button key={p.id} type="button" onClick={() => void openPull(p.number)} className="w-full text-left p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium">#{p.number} {p.title}</div><div className="mt-2 text-[11px] text-zinc-400">{p.user?.login} · {p.head?.ref} → {p.base?.ref}</div></div><span className="text-[10px] uppercase text-zinc-400">{p.state}</span></div>
            </button>
          ))}
        </div>
      )}

      {!loading && tab === "issues" && (
        <div className="space-y-3">
          <button onClick={createIssue} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs"><Plus className="w-3.5 h-3.5" /> Create issue</button>
          {issues.map((issue: any) => (
            <button key={issue.id} type="button" onClick={() => void openIssue(issue.number)} className="w-full text-left p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <div className="flex justify-between gap-3"><span className="text-sm font-medium">#{issue.number} {issue.title}</span><span className="text-[10px] uppercase text-zinc-400">{issue.state}</span></div>
              <div className="mt-2 text-[11px] text-zinc-400">{issue.user?.login} · {formatDate(issue.updated_at)}</div>
              <div className="mt-2 flex flex-wrap gap-1">{(issue.labels || []).slice(0, 6).map((label: any) => <span key={label.id || label.name} className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[9px]">{label.name}</span>)}</div>
            </button>
          ))}
        </div>
      )}

      {!loading && tab === "releases" && (
        <div className="grid gap-3">{releases.map((release: any) => <div key={release.id} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800"><div className="flex justify-between gap-3"><div><div className="text-sm font-medium">{release.name || release.tag_name}</div><div className="mt-1 text-[11px] text-zinc-400">{release.tag_name} · {formatDate(release.published_at || release.created_at)}</div></div><a href={release.html_url} target="_blank" rel="noreferrer" className="text-[10px] text-zinc-400 hover:text-zinc-900">GitHub</a></div>{release.body && <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap line-clamp-6">{release.body}</div>}</div>)}{releases.length === 0 && <EmptyState title="No releases recorded" description="GitHub has no releases for this repository." />}</div>
      )}

      {!loading && tab === "tags" && (
        <div className="grid gap-2">{tags.map((tag: any) => <a key={tag.name} href={tag.commit?.url || `https://github.com/${currentProject.repository}/tree/${encodeURIComponent(tag.name)}`} target="_blank" rel="noreferrer" className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900"><div><div className="font-mono text-sm">{tag.name}</div><div className="text-[10px] text-zinc-400 mt-1">{tag.commit?.sha?.slice(0, 12)}</div></div><Tag className="w-4 h-4 text-zinc-400" /></a>)}{tags.length === 0 && <EmptyState title="No tags recorded" description="GitHub has no tags for this repository." />}</div>
      )}

      {!loading && tab === "contributors" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{contributors.map((c: any) => <a key={c.id || c.login} href={c.html_url} target="_blank" rel="noreferrer" className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"><img src={c.avatar_url} alt="" className="w-8 h-8 rounded-full" /><div className="min-w-0"><div className="text-sm font-medium truncate">{c.login}</div><div className="text-[11px] text-zinc-400">{c.contributions} contributions</div></div></a>)}</div>
      )}

      {!loading && tab === "activity" && (
        <div className="space-y-2">
          {activity.map((event: any) => (
            <div key={event.id} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex gap-3">
              <div className="mt-0.5"><Activity className="w-4 h-4 text-zinc-400" /></div>
              <div className="min-w-0 flex-1"><div className="text-[10px] uppercase tracking-wider text-zinc-400">{event.type}</div><div className="text-sm font-medium truncate">{event.title}</div><div className="mt-1 text-[11px] text-zinc-400">{event.actor} · {formatDate(event.timestamp)}</div></div>
              {event.url && <a href={event.url} target="_blank" rel="noreferrer" className="self-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><ChevronRight className="w-4 h-4" /></a>}
            </div>
          ))}
          {activity.length === 0 && <EmptyState title="No recent activity" description="No repository activity was returned by GitHub." />}
        </div>
      )}

      {changeAnalysisLoading && (
        <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 flex items-center justify-center p-6"><div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-5 py-4 text-xs text-zinc-600 dark:text-zinc-300 flex items-center gap-2"><Sparkles className="w-4 h-4 animate-pulse" /> Investigating repository evidence…</div></div>
      )}

      {changeAnalysis && !changeAnalysisLoading && (
        <div className="fixed inset-y-4 right-4 z-50 w-[min(560px,calc(100vw-2rem))] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono">Change Analysis</div><div className="text-sm font-semibold mt-0.5">{changeAnalysis.evidence?.subject?.title || "Repository change"}</div></div><button type="button" onClick={() => setChangeAnalysis(null)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400"><X className="w-4 h-4" /></button></div>
          <div className="max-h-[calc(100vh-2rem)] overflow-auto p-4 space-y-4">{changeAnalysis.error ? <div className="text-xs text-rose-600 dark:text-rose-400">{changeAnalysis.error}</div> : <><p className="text-sm leading-relaxed">{changeAnalysis.analysis?.summary}</p>{[["KNOWN", changeAnalysis.analysis?.known],["INFERRED", changeAnalysis.analysis?.inferred],["UNKNOWN", changeAnalysis.analysis?.unknown]].map(([label, values]: any) => values?.length ? <div key={label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3"><div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 mb-2">{label}</div><div className="space-y-1.5 text-xs">{values.map((value: string, index: number) => <div key={index}>{value}</div>)}</div></div> : null)}{changeAnalysis.analysis?.potentialImpact?.length > 0 && <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3"><div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 mb-2">Potential impact</div><div className="space-y-1.5 text-xs">{changeAnalysis.analysis.potentialImpact.map((value: string, index: number) => <div key={index}>{value}</div>)}</div></div>}</>}</div>
        </div>
      )}

      {issueDetail && (
        <div className="fixed inset-y-4 right-4 z-50 w-[min(620px,calc(100vw-2rem))] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono">Issue #{issueDetail.issue?.number}</div><div className="text-sm font-semibold">{issueDetail.issue?.title}</div></div><button onClick={() => setIssueDetail(null)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"><X className="w-4 h-4" /></button></div>
          <div className="max-h-[calc(100vh-2rem)] overflow-auto p-4 space-y-5">
            <div className="grid gap-3">
              <input value={issueDraft.title} onChange={(e) => setIssueDraft({ ...issueDraft, title: e.target.value })} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm font-medium" />
              <textarea value={issueDraft.body} onChange={(e) => setIssueDraft({ ...issueDraft, body: e.target.value })} rows={5} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-xs resize-y" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={issueDraft.labels} onChange={(e) => setIssueDraft({ ...issueDraft, labels: e.target.value })} placeholder="labels: bug, api" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-xs" />
                <input value={issueDraft.assignees} onChange={(e) => setIssueDraft({ ...issueDraft, assignees: e.target.value })} placeholder="assignees: login" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-xs" />
                <input value={issueDraft.milestone} onChange={(e) => setIssueDraft({ ...issueDraft, milestone: e.target.value })} placeholder="milestone #" className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-xs" />
              </div>
              <div className="flex flex-wrap gap-2"><button onClick={() => void saveIssue()} disabled={issueSaving} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs disabled:opacity-50"><Save className="w-3.5 h-3.5" /> Save issue</button><button onClick={() => void toggleIssueState()} disabled={issueSaving} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">{issueDetail.issue?.state === "open" ? "Close issue" : "Reopen issue"}</button></div>
            </div>
            <div><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-400 font-semibold"><MessageSquare className="w-3.5 h-3.5" /> Conversation</div><div className="mt-3 space-y-2">{(issueDetail.comments || []).map((comment: any) => <div key={comment.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3"><div className="text-[10px] text-zinc-400">{comment.user?.login} · {formatDate(comment.created_at)}</div><div className="mt-2 text-xs whitespace-pre-wrap">{comment.body}</div></div>)}</div><div className="mt-3 flex gap-2"><textarea value={issueComment} onChange={(e) => setIssueComment(e.target.value)} rows={2} placeholder="Add a comment…" className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-xs resize-none" /><button onClick={() => void postIssueComment()} disabled={issueSaving || !issueComment.trim()} className="self-end px-3 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs disabled:opacity-50">Comment</button></div></div>
          </div>
        </div>
      )}

      {pullDetail && (
        <div className="fixed inset-y-4 right-4 z-50 w-[min(700px,calc(100vw-2rem))] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono">Pull Request #{pullDetail.pull?.number}</div><div className="text-sm font-semibold">{pullDetail.pull?.title}</div></div><button onClick={() => setPullDetail(null)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"><X className="w-4 h-4" /></button></div>
          <div className="max-h-[calc(100vh-2rem)] overflow-auto p-4 space-y-5">
            <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400"><span>{pullDetail.pull?.user?.login}</span><span>·</span><span>{pullDetail.pull?.head?.ref} → {pullDetail.pull?.base?.ref}</span><span>·</span><span>{pullDetail.pull?.state}</span></div>
            {pullDetail.pull?.body && <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-xs whitespace-pre-wrap">{pullDetail.pull.body}</div>}
            <div><div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Changed files ({pullDetail.files?.length || 0})</div><div className="mt-2 space-y-1">{(pullDetail.files || []).slice(0, 100).map((file: any) => <div key={file.filename} className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-[10px] font-mono flex justify-between gap-2"><span className="truncate">{file.filename}</span><span className="shrink-0 text-zinc-400">+{file.additions || 0} / -{file.deletions || 0}</span></div>)}</div></div>
            <div><div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Reviews</div><div className="mt-2 space-y-1">{(pullDetail.reviews || []).map((review: any) => <div key={review.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs"><span className="font-medium">{review.user?.login}</span> · {review.state}<div className="mt-1 text-[10px] text-zinc-400 whitespace-pre-wrap">{review.body || "No review body."}</div></div>)}{pullDetail.reviews?.length === 0 && <div className="text-xs text-zinc-400">No reviews returned.</div>}</div></div>
            <div><div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Conversation</div><div className="mt-3 flex gap-2"><textarea value={pullComment} onChange={(e) => setPullComment(e.target.value)} rows={2} placeholder="Comment on this pull request…" className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-xs resize-none" /><button onClick={() => void postPullComment()} disabled={pullSaving || !pullComment.trim()} className="self-end px-3 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs disabled:opacity-50">Comment</button></div></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void togglePullState()} disabled={pullSaving} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs disabled:opacity-50">
                {pullDetail.pull?.state === "open" ? "Close pull request" : "Reopen pull request"}
              </button>
              <button type="button" onClick={() => void analyzeChange({ pullRequestNumber: pullDetail.pull?.number, question: "Review this pull request from an architectural, dependency, and potential-impact perspective using only repository evidence." })} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs"><Sparkles className="w-3.5 h-3.5" /> AFTER Review</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
