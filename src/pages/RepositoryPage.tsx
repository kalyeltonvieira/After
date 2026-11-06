import React, { useEffect, useMemo, useState } from "react";
import {
  GitBranch, FileCode2, GitCommit, GitPullRequest, CircleDot, Package, Users,
  Search, Plus, Eye, ExternalLink, RefreshCw, Sparkles, X, Tag, Activity,
  Copy, Check, GitCompare, MessageSquare, Save, ChevronRight, Clock3, Folder,
  ShieldAlert, AlertTriangle, AlertCircle, RotateCcw, ChevronDown, ChevronUp, Terminal,
} from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-sql";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { authenticatedHeaders } from "../lib/api";
import { EmptyState } from "../components/EmptyState";
import { getGitHubAuthUrl, openGitHubOAuthPopup, exchangeGitHubCode } from "../services/githubService";
import { LanguageColorDot, getLanguageColorByExtension } from "../utils/languageColors";

type Tab = "code" | "branches" | "commits" | "pulls" | "issues" | "releases" | "tags" | "contributors" | "activity";

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function formatTimeAgo(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diffSecs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSecs < 60) return "just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  if (diffSecs < 2592000) return `${Math.floor(diffSecs / 86400)}d ago`;
  if (diffSecs < 31536000) return `${Math.floor(diffSecs / 2592000)}mo ago`;
  return `${Math.floor(diffSecs / 31536000)}y ago`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightLine(line: string, language: string): string {
  if (!line || !line.trim()) return line ? escapeHtml(line) : "&nbsp;";
  // Avoid blocking the main thread on generated/minified one-line files.
  if (line.length > 20_000) return escapeHtml(line);
  const lang = language.toLowerCase();
  const grammar =
    Prism.languages[lang] ||
    (lang === "typescript-react" ? Prism.languages.tsx : null) ||
    (lang === "javascript-react" ? Prism.languages.jsx : null) ||
    Prism.languages.typescript ||
    Prism.languages.javascript ||
    Prism.languages.clike;

  if (!grammar) {
    return escapeHtml(line);
  }

  try {
    const highlighted = Prism.highlight(line, grammar, lang);
    return highlighted || "&nbsp;";
  } catch {
    return escapeHtml(line);
  }
}

function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "ts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "jsx";
    case "css":
    case "scss":
    case "sass":
    case "less":
      return "css";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "py":
      return "python";
    case "sh":
    case "bash":
    case "zsh":
      return "bash";
    case "yaml":
    case "yml":
      return "yaml";
    case "sql":
      return "sql";
    case "html":
    case "htm":
    case "xml":
    case "svg":
      return "markup";
    default:
      return ext || "text";
  }
}

function binaryExtension(path: string): string {
  return path.split(".").pop()?.toLowerCase() || "";
}

function BinaryFallback({ file, label }: { file: any; label: string }) {
  const name = String(file?.path || "file").split("/").pop() || "file";
  const href = file?.contentBase64 ? `data:${file.contentType || "application/octet-stream"};base64,${file.contentBase64}` : "#";
  return <div className="h-full min-h-[360px] flex flex-col items-center justify-center gap-3 p-8 text-center bg-zinc-950 text-zinc-300"><div className="text-sm font-medium">{name}</div><p className="max-w-md text-xs text-zinc-500">{label}</p><a href={href} download={name} className="rounded-xl bg-white text-zinc-900 px-4 py-2 text-xs font-medium">Download file</a></div>;
}

function parseCsv(text: string): { rows: string[][]; delimiter: string } {
  const sample = text.split(/\r?\n/, 5).join("\n");
  const candidates = [",", ";", "\t", "|"];
  const delimiter = candidates.sort((a, b) => sample.split(b).length - sample.split(a).length)[0] || ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return { rows: rows.length ? rows : [[]], delimiter };
}

function serializeCsv(rows: string[][], delimiter: string): string {
  return rows.map((row) => row.map((cell) => {
    const value = String(cell ?? "");
    return /["\n\r]/.test(value) || value.includes(delimiter) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(delimiter)).join("\n");
}

function CsvFilePreview({ file, onSave }: { file: any; onSave: (content: string) => Promise<void> }) {
  const [rows, setRows] = useState<string[][]>(() => parseCsv(String(file?.content || "")).rows);
  const [delimiter, setDelimiter] = useState(",");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const parsed = parseCsv(String(file?.content || ""));
    setRows(parsed.rows); setDelimiter(parsed.delimiter); setDirty(false);
  }, [file?.path, file?.content]);
  const columnCount = Math.max(1, Math.min(100, rows.reduce((largest, row) => Math.max(largest, row.length), 0)));
  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    setRows((current) => current.map((row, index) => index === rowIndex ? Object.assign([...row], { [columnIndex]: value }) : row));
    setDirty(true);
  };
  const addRow = () => { setRows((current) => [...current, Array(columnCount).fill("")]); setDirty(true); };
  const addColumn = () => { setRows((current) => current.map((row) => [...row, ""])); setDirty(true); };
  const deleteRow = () => { if (rows.length > 1) { setRows((current) => current.slice(0, -1)); setDirty(true); } };
  const download = () => { const blob = new Blob([serializeCsv(rows, delimiter)], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = String(file?.path || "data.csv").split("/").pop() || "data.csv"; anchor.click(); URL.revokeObjectURL(url); };
  const save = async () => { setSaving(true); try { await onSave(serializeCsv(rows, delimiter)); setDirty(false); } finally { setSaving(false); } };
  return <div className="h-full min-h-[360px] flex flex-col bg-white dark:bg-zinc-950">
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs">
      <span className="font-semibold mr-auto">CSV editor</span><span className="text-zinc-400">{rows.length} rows · {columnCount} columns</span>
      <select value={delimiter} onChange={(event) => { setDelimiter(event.target.value); setDirty(true); }} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-[11px]"><option value=",">Comma</option><option value=";">Semicolon</option><option value="\t">Tab</option><option value="|">Pipe</option></select>
      <button type="button" onClick={addRow} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1">+ Row</button><button type="button" onClick={addColumn} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1">+ Column</button><button type="button" onClick={deleteRow} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1">− Row</button><button type="button" onClick={download} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1">Download</button><button type="button" onClick={() => void save()} disabled={!dirty || saving} className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1 disabled:opacity-40">{saving ? "Saving…" : "Save to GitHub"}</button>
    </div>
    <div className="flex-1 overflow-auto"><table className="min-w-max border-collapse text-xs"><tbody>{rows.slice(0, 5000).map((row, rowIndex) => <tr key={rowIndex} className="hover:bg-sky-50 dark:hover:bg-sky-950/20"><th className="sticky left-0 z-10 border-r border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400 font-mono">{rowIndex + 1}</th>{Array.from({ length: columnCount }).map((_, columnIndex) => <td key={columnIndex} className="border-r border-b border-zinc-200 dark:border-zinc-800 p-0"><input value={row[columnIndex] || ""} onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)} className="w-40 bg-transparent px-2 py-1.5 outline-none focus:bg-sky-50 dark:focus:bg-sky-950/40" aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`} /></td>)}</tr>)}</tbody></table>{rows.length > 5000 && <div className="p-3 text-[10px] text-zinc-400">Showing the first 5,000 rows. Saving preserves the complete CSV.</div>}</div>
  </div>;
}

function BinaryFilePreview({ file }: { file: any }) {
  const extension = binaryExtension(String(file?.path || ""));
  const dataUrl = file?.contentBase64
    ? `data:${file.contentType || "application/octet-stream"};base64,${file.contentBase64}`
    : "";
  const downloadName = String(file?.path || "file").split("/").pop() || "file";
  const [spreadsheet, setSpreadsheet] = useState<{ sheetName: string; sheetCount: number; rows: any[][] } | null>(null);
  useEffect(() => {
    let active = true;
    setSpreadsheet(null);
    if (file?.contentBase64 && ["xlsx", "xls", "xlsm", "xlsb"].includes(extension)) {
      void import("xlsx").then((XLSX) => {
        try {
          const bytes = Uint8Array.from(atob(file.contentBase64), (char) => char.charCodeAt(0));
          const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const rows = sheetName ? XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1, raw: false }) : [];
          if (active && sheetName) setSpreadsheet({ sheetName, sheetCount: workbook.SheetNames.length, rows });
        } catch {
          if (active) setSpreadsheet(null);
        }
      });
    }
    return () => { active = false; };
  }, [file?.contentBase64, extension]);

  if (["xlsx", "xls", "xlsm", "xlsb"].includes(extension)) {
    const sheet = spreadsheet?.sheetName;
    const rows = spreadsheet?.rows || [];
    const columnCount = Math.min(80, Math.max(1, ...rows.slice(0, 1000).map((row) => row.length)));
    return <div className="h-full overflow-auto bg-white dark:bg-zinc-950 p-4">{spreadsheet && sheet ? <div className="min-w-max rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"><div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold border-b border-zinc-200 dark:border-zinc-800">{sheet} · {spreadsheet.sheetCount} {spreadsheet.sheetCount === 1 ? "sheet" : "sheets"}</div><table className="border-collapse text-xs"><tbody>{rows.slice(0, 1000).map((row, rowIndex) => <tr key={rowIndex} className="hover:bg-sky-50 dark:hover:bg-sky-950/30">{Array.from({ length: columnCount }).map((_, columnIndex) => <td key={columnIndex} className="border-r border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 whitespace-nowrap">{row[columnIndex] == null ? "" : String(row[columnIndex])}</td>)}</tr>)}</tbody></table>{rows.length > 1000 && <div className="px-3 py-2 text-[10px] text-zinc-400 border-t border-zinc-200 dark:border-zinc-800">Preview limited to the first 1,000 rows.</div>}</div> : <BinaryFallback file={file} label="Não foi possível interpretar esta planilha." />}</div>;
  }
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) return <div className="h-full overflow-auto flex items-center justify-center p-8 bg-zinc-100 dark:bg-zinc-950"><img src={dataUrl} alt={downloadName} className="max-w-full max-h-full object-contain rounded-lg shadow-xl" /></div>;
  if (extension === "pdf") return <iframe title={downloadName} src={dataUrl} className="w-full h-full min-h-[560px] bg-white" />;
  if (["mp3", "wav", "ogg"].includes(extension)) return <div className="h-full flex items-center justify-center p-8 bg-zinc-950"><audio controls src={dataUrl} className="w-full max-w-xl" /></div>;
  if (["mp4", "webm", "mov"].includes(extension)) return <div className="h-full flex items-center justify-center p-8 bg-zinc-950"><video controls src={dataUrl} className="max-w-full max-h-full rounded-xl" /></div>;
  return <BinaryFallback file={file} label="Este formato pode ser baixado, mas não possui um visualizador web nativo." />;
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
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [showBlame, setShowBlame] = useState(false);
  const [blameLoading, setBlameLoading] = useState(false);
  const [blame, setBlame] = useState<any[]>([]);
  const [hoveredCommitSha, setHoveredCommitSha] = useState<string | null>(null);
  const [commitDetail, setCommitDetail] = useState<any>(null);
  const [codeScrollTop, setCodeScrollTop] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);

  const { refreshGitHubSession } = useAuth();
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
    const res = await fetch(path, { ...init, headers: { ...(await authenticatedHeaders({}, true)), ...(init?.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || `Request failed (${res.status})`);
      (err as any).status = res.status;
      (err as any).isRateLimit = Boolean(body.isRateLimit || res.status === 429 || /rate limit/i.test(body.error || ""));
      (err as any).isUnauthorized = Boolean(body.isUnauthorized || res.status === 401 || res.status === 403);
      (err as any).isHtml = Boolean(body.isHtml);
      throw err;
    }
    return body;
  };

  const handleConnectGitHub = async () => {
    setReconnecting(true);
    try {
      const authInfo = await getGitHubAuthUrl().catch(() => null);
      if (authInfo?.configured && authInfo?.url) {
        const popupRes = await openGitHubOAuthPopup(authInfo.url);
        if (popupRes.code) {
          await exchangeGitHubCode(popupRes.code);
        }
      }
      await refreshGitHubSession();
      await loadBranches();
      await loadTab();
    } catch (err: any) {
      window.alert(err?.message || "Failed to connect GitHub session.");
    } finally {
      setReconnecting(false);
    }
  };

  const loadBranches = async () => {
    if (!projectId) return;
    try {
      const body = await request(`/api/repository/branches?projectId=${encodeURIComponent(projectId)}&per_page=100`);
      const next = Array.isArray(body.branches) ? body.branches : [];
      setBranches(next);
      if (!compareBase) setCompareBase(currentProject?.defaultBranch || currentProject?.branch || next[0]?.name || "");
      if (!compareHead) setCompareHead(currentProject?.branch || next[1]?.name || next[0]?.name || "");
    } catch (error: any) {
      const msg = error?.message || String(error);
      const isRateLimit = Boolean(error?.isRateLimit || error?.status === 429 || /rate limit/i.test(msg));
      const isUnauthorized = Boolean(error?.isUnauthorized || error?.status === 401 || error?.status === 403 || isRateLimit);
      setData((prev: any) => ({ ...prev, error: msg, isRateLimit, isUnauthorized }));
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
    } catch (error: any) {
      const msg = error?.message || String(error);
      const isRateLimit = Boolean(error?.isRateLimit || error?.status === 429 || /rate limit/i.test(msg));
      const isUnauthorized = Boolean(error?.isUnauthorized || error?.status === 401 || error?.status === 403 || isRateLimit);
      setData({ error: msg, isRateLimit, isUnauthorized });
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
        request(`/api/repository/file-history?projectId=${encodeURIComponent(projectId!)}&path=${encodeURIComponent(path)}&ref=${encodeURIComponent(currentProject.branch)}&per_page=12`).catch(() => ({ commits: [] })),
      ]);
      setData((prev: any) => ({ ...prev, file, fileHistory: history?.commits || [] }));
      setBlame([]);
      setShowBlame(false);
      setAiContext({
        type: "file",
        label: path,
        path,
        content: typeof file.content === "string" ? file.content.slice(0, 24000) : undefined,
      });
    } catch (error: any) {
      const msg = error?.message || String(error);
      const isRateLimit = Boolean(error?.isRateLimit || error?.status === 429 || /rate limit/i.test(msg));
      const isUnauthorized = Boolean(error?.isUnauthorized || error?.status === 401 || error?.status === 403 || isRateLimit);
      setData((prev: any) => ({ ...prev, file: null, error: msg, isRateLimit, isUnauthorized }));
    }
  };

  useEffect(() => {
    if (tab === "code" && Array.isArray(data?.tree) && data.tree.length > 0 && !selectedFile) {
      const preferred =
        data.tree.find((f: any) => f.path === "README.md" || f.path === "src/App.tsx" || f.path === "package.json") ||
        data.tree.find((f: any) => !f.path.includes("/")) ||
        data.tree[0];
      if (preferred && preferred.path) {
        void openFile(preferred.path);
      }
    }
  }, [tab, data?.tree, selectedFile]);

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
      const repositoryWatch = Array.isArray(existing.watchTargets)
        ? existing.watchTargets.find((watch: any) => watch.type === "repository")
        : null;
      await request("/api/repository/watch", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          type: "repository",
          target: currentProject.repository,
          enabled: !repositoryWatch,
        }),
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

  const createPull = async () => {
    const title = window.prompt("Pull request title");
    if (!title) return;
    const body = window.prompt("Pull request description") || "";
    const head = window.prompt("Head branch", currentProject?.branch || "");
    if (!head) return;
    const base = window.prompt("Base branch", currentProject?.defaultBranch || "main");
    if (!base) return;
    try {
      await request("/api/repository/pulls", {
        method: "POST",
        body: JSON.stringify({ projectId, title, body, head, base }),
      });
      await loadTab();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
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

  const saveCsv = async (content: string) => {
    if (!data.file?.path || !projectId) return;
    const body = await request("/api/repository/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        path: data.file.path,
        branch: currentProject.branch,
        sha: data.file.sha,
        content,
        message: `Update ${data.file.path}`,
      }),
    });
    setData((previous: any) => ({
      ...previous,
      file: { ...previous.file, content, sha: body.sha || previous.file.sha, size: new Blob([content]).size },
    }));
  };

  const toggleBlame = async () => {
    if (!data.file?.path) return;
    if (showBlame) {
      setShowBlame(false);
      return;
    }

    if (blame.length > 0) {
      setShowBlame(true);
      return;
    }

    setBlameLoading(true);
    try {
      const body = await request(
        `/api/repository/file-blame?projectId=${encodeURIComponent(projectId!)}&path=${encodeURIComponent(data.file.path)}&ref=${encodeURIComponent(currentProject.branch)}`
      );
      setBlame(Array.isArray(body.ranges) ? body.ranges : []);
      setShowBlame(true);
    } catch (error) {
      console.warn("Could not retrieve blame data:", error);
      setBlame([]);
      setShowBlame(true);
    } finally {
      setBlameLoading(false);
    }
  };

  const openCommit = async (sha: string) => {
    try {
      setCommitDetail(await request(
        `/api/repository/commits/${encodeURIComponent(sha)}?projectId=${encodeURIComponent(projectId!)}`
      ));
    } catch (error) {
      console.warn("Could not load commit details:", error);
    }
  };

  const treeFiles = (data.tree || [])
    .filter((item: any) => item.type === "blob")
    .filter((item: any) => {
      const query = search.trim().toLowerCase();
      return !query || String(item.path).toLowerCase().includes(query);
    })
    .slice(0, 600);

  const treeRows = useMemo(() => {
    const sourceItems = Array.isArray(data.tree) ? data.tree.filter((item: any) => item.type === "blob") : [];
    const query = search.trim().toLowerCase();
    const matchedFiles = sourceItems.filter((item: any) =>
      !query || String(item.path).toLowerCase().includes(query)
    );
    const matchedPaths = new Set<string>();

    for (const item of matchedFiles) {
      const parts = String(item.path).split("/");
      for (let i = 1; i < parts.length; i += 1) {
        matchedPaths.add(parts.slice(0, i).join("/"));
      }
    }

    const rows = new Map<string, { path: string; kind: "directory" | "file"; name: string; depth: number }>();

    for (const item of matchedFiles) {
      const parts = String(item.path).split("/");
      for (let i = 1; i < parts.length; i += 1) {
        const dirPath = parts.slice(0, i).join("/");
        rows.set(dirPath, {
          path: dirPath,
          kind: "directory",
          name: parts[i - 1],
          depth: i - 1,
        });
      }
      rows.set(String(item.path), {
        path: String(item.path),
        kind: "file",
        name: parts[parts.length - 1],
        depth: Math.max(0, parts.length - 1),
      });
    }

    const isHidden = (path: string) => {
      const parts = path.split("/");
      for (let i = 1; i < parts.length; i += 1) {
        if (collapsedDirs.has(parts.slice(0, i).join("/"))) return true;
      }
      return false;
    };

    return [...rows.values()]
      .filter((row) => matchedPaths.has(row.path) || row.kind === "file")
      .filter((row) => !isHidden(row.path))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [data.tree, search, collapsedDirs]);

  const blameForLine = (lineNumber: number) =>
    blame.find((range) => lineNumber >= Number(range.startingLine) && lineNumber <= Number(range.endingLine)) || null;

  const filteredBranches = branches.filter((b) => String(b.name).toLowerCase().includes(branchSearch.toLowerCase()));
  const commits = data.commits || [];
  const pulls = data.pulls || [];
  const issues = data.issues || [];
  const releases = data.releases || [];
  const tags = data.tags || [];
  const contributors = data.contributors || [];
  const activity = data.events || [];
  const codeLines = useMemo(
    () => (data.file?.content ? String(data.file.content).split("\n") : []),
    [data.file?.content]
  );
  const lineCount = codeLines.length;
  const codeLineHeight = 20;
  const codeHeaderHeight = showBlame ? 36 : 0;
  const codeWindow = useMemo(() => {
    const viewportHeight = 720;
    const firstVisible = Math.max(0, Math.floor(Math.max(0, codeScrollTop - codeHeaderHeight) / codeLineHeight) - 80);
    const lastVisible = Math.min(
      codeLines.length,
      Math.ceil(Math.max(0, codeScrollTop - codeHeaderHeight + viewportHeight) / codeLineHeight) + 80
    );
    return {
      start: firstVisible,
      end: Math.max(firstVisible, lastVisible),
      top: firstVisible * codeLineHeight,
      bottom: Math.max(0, (codeLines.length - lastVisible) * codeLineHeight),
    };
  }, [codeLines.length, codeHeaderHeight, codeScrollTop]);
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

      {data.error && (
        <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 space-y-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-semibold text-rose-900 dark:text-rose-100">
                {data.isRateLimit
                  ? "GitHub API Rate Limit Reached"
                  : data.isUnauthorized
                  ? "GitHub Authorization Required"
                  : "Repository Fetch Issue"}
              </h3>
              <p className="text-xs mt-1 leading-relaxed opacity-90">{data.error}</p>
              {data.isRateLimit && (
                <p className="text-[11px] mt-1.5 text-rose-700 dark:text-rose-300">
                  Tip: Unauthenticated GitHub API calls are limited to 60 requests/hour per IP. Connecting your GitHub account via OAuth provides 5,000 requests/hour and private repo access.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/40">
            {(data.isRateLimit || data.isUnauthorized) && (
              <button
                type="button"
                onClick={handleConnectGitHub}
                disabled={reconnecting}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? "animate-spin" : ""}`} />
                <span>{reconnecting ? "Connecting..." : "Connect GitHub Account"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadTab()}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-xs font-medium hover:bg-rose-100 dark:hover:bg-rose-900/50 flex items-center space-x-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      )}
      {loading && <div className="py-10 text-center text-xs text-zinc-400">Loading real repository data…</div>}

      {!loading && tab === "code" && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] gap-4 items-start">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 overflow-hidden xl:h-[min(64vh,720px)] xl:flex xl:flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-zinc-400">Explorer</div>
                  <div className="mt-1 text-xs font-semibold truncate">{currentProject.repository}</div>
                </div>
                <span className="shrink-0 rounded-md bg-zinc-200/70 dark:bg-zinc-800 px-1.5 py-1 text-[9px] font-mono text-zinc-500">{treeFiles.length} files</span>
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter files and folders…" className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/70 pl-9 pr-3 py-2 text-xs outline-none focus:border-sky-400 dark:focus:border-sky-700" />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 overscroll-contain">
              {treeRows.map((item) => (
                item.kind === "directory" ? (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => setCollapsedDirs((current) => {
                      const next = new Set(current);
                      if (next.has(item.path)) next.delete(item.path);
                      else next.add(item.path);
                      return next;
                    })}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg font-mono text-[10px] text-zinc-500 hover:bg-sky-50 dark:hover:bg-sky-950/30 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1.5 transition-colors"
                    style={{ paddingLeft: `${8 + item.depth * 14}px` }}
                  >
                    {collapsedDirs.has(item.path) ? <ChevronRight className="w-3 h-3 shrink-0 text-zinc-400" /> : <ChevronDown className="w-3 h-3 shrink-0 text-sky-500" />}
                    <Folder className={`w-3.5 h-3.5 shrink-0 ${collapsedDirs.has(item.path) ? "text-zinc-400" : "text-sky-500"}`} />
                    <span className="truncate">{item.name}</span>
                  </button>
                ) : (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => void openFile(item.path)}
                    className={`group w-full text-left px-2.5 py-1.5 rounded-lg font-mono text-[11px] hover:bg-sky-50 dark:hover:bg-sky-950/30 flex items-center gap-2 transition-colors ${selectedFile === item.path ? "bg-sky-100/80 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 ring-1 ring-inset ring-sky-300/70 dark:ring-sky-800" : "text-zinc-600 dark:text-zinc-400"}`}
                    style={{ paddingLeft: `${8 + item.depth * 14}px` }}
                    title={item.path}
                  >
                    <LanguageColorDot filename={item.name} size="xs" className="shrink-0" />
                    <span className="w-5 shrink-0 text-center text-[8px] font-semibold tracking-tight group-hover:text-sky-500" style={{ color: getLanguageColorByExtension(item.name) }}>{item.name.split(".").pop()?.slice(0, 4).toUpperCase() || "FILE"}</span>
                    <FileCode2 className={`w-3.5 h-3.5 shrink-0 ${selectedFile === item.path ? "text-sky-500" : "text-zinc-400"}`} />
                    <span className="truncate">{item.name}</span>
                  </button>
                )
              ))}
              {treeRows.length === 0 && <p className="p-6 text-center text-xs text-zinc-400">No source file matched.</p>}
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                    {data.file?.path ? <LanguageColorDot filename={data.file.path} size="xs" /> : <FileCode2 className="w-3.5 h-3.5 text-sky-400" />}
                    <span>CODE VIEW</span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-zinc-100 truncate flex items-center gap-2">
                    {data.file?.path && <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: getLanguageColorByExtension(data.file.path) }} />}
                    <span>{data.file?.path || "Select a file"}</span>
                  </div>
                  {data.file?.path && (
                    <>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {data.file.path.split("/").map((part: string, index: number) => <React.Fragment key={`${part}-${index}`}><span className={`font-mono text-[10px] ${index === data.file.path.split("/").length - 1 ? "text-sky-300" : "text-zinc-500"}`}>{part}</span>{index < data.file.path.split("/").length - 1 && <ChevronRight className="w-3 h-3 text-zinc-700" />}</React.Fragment>)}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1">{languageFromPath(data.file.path)} · {lineCount} lines · {data.file.size ?? "?"} bytes · {currentProject.branch}</div>
                    </>
                  )}
                </div>
                {data.file?.path && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {!data.file.isBinary && <button type="button" onClick={() => void copyFile()} className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px]">
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
                    </button>}
                    {!data.file.isBinary && binaryExtension(data.file.path) !== "csv" && <button
                      type="button"
                      onClick={() => void toggleBlame()}
                      disabled={blameLoading}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                        showBlame
                          ? "border-sky-500 bg-sky-500/10 text-sky-400 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-300"
                          : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                      title="Toggle git blame annotations to view authorship, commit hash, date, and commit message for each line"
                    >
                      {blameLoading ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
                      ) : (
                        <GitCommit className="w-3 h-3" />
                      )}
                      <span>{blameLoading ? "Loading Blame…" : showBlame ? "Hide Blame" : "Git Blame"}</span>
                      {showBlame && blame.length > 0 && (
                        <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] bg-sky-500/20 text-sky-300 font-mono">
                          {blame.length}
                        </span>
                      )}
                    </button>}
                    <button type="button" onClick={() => void analyzeChange({ path: data.file.path, question: "Analyze this file's current repository state, recent history, related graph relationships, and potential impact of changing it." })} className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px]">
                      <Sparkles className="w-3 h-3" /> Analyze
                    </button>
                    <button type="button" onClick={() => setIsAskAfterOpen(true)} className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[11px] font-medium">
                      Ask AFTER
                    </button>
                  </div>
                )}
              </div>
              <div
                key={data.file?.path || "empty-code-view"}
                className="h-[min(64vh,720px)] min-h-[360px] overflow-auto overscroll-contain bg-zinc-950"
                onScroll={(event) => setCodeScrollTop(event.currentTarget.scrollTop)}
              >
                {data.file?.isBinary ? <BinaryFilePreview file={data.file} /> : binaryExtension(data.file?.path || "") === "csv" ? <CsvFilePreview file={data.file} onSave={saveCsv} /> : data.file?.content ? (
                  <div className="min-w-max font-mono text-[11px] leading-relaxed text-zinc-100">
                    {showBlame && (
                      <div className="sticky top-0 z-10 flex border-b border-zinc-800 bg-zinc-900/95 backdrop-blur text-[10px] uppercase tracking-wider font-mono text-zinc-400 py-1.5 select-none">
                        <div className="w-64 shrink-0 px-3 flex items-center justify-between">
                          <span>Author & Commit</span>
                          <span className="text-[9px] text-zinc-500 lowercase">click to inspect</span>
                        </div>
                        <div className="w-12 shrink-0 text-right pr-3 text-zinc-500">Line</div>
                        <div className="px-3 text-zinc-500">Source Code</div>
                      </div>
                    )}
                    <div style={{ height: codeWindow.top }} aria-hidden="true" />
                    {codeLines.slice(codeWindow.start, codeWindow.end).map((line: string, visibleIndex: number) => {
                      const index = codeWindow.start + visibleIndex;
                      const lineNumber = index + 1;
                      const lineBlame = showBlame ? blameForLine(lineNumber) : null;
                      const isHoveredCommit = Boolean(
                        lineBlame?.commit?.oid && hoveredCommitSha === lineBlame.commit.oid
                      );
                      const prevBlame = showBlame && index > 0 ? blameForLine(lineNumber - 1) : null;
                      const isRangeHeader = !prevBlame || prevBlame.commit?.oid !== lineBlame?.commit?.oid;
                      const fileLang = languageFromPath(data.file.path);

                      return (
                        <div
                          key={index}
                          id={`code-line-${lineNumber}`}
                          className={`flex scroll-mt-24 transition-colors ${
                            isHoveredCommit ? "bg-sky-950/40" : "hover:bg-zinc-900/40"
                          }`}
                        >
                          {showBlame && (
                            <button
                              type="button"
                              onClick={() => lineBlame?.commit?.oid && void openCommit(lineBlame.commit.oid)}
                              onMouseEnter={() => lineBlame?.commit?.oid && setHoveredCommitSha(lineBlame.commit.oid)}
                              onMouseLeave={() => setHoveredCommitSha(null)}
                              className={`select-none w-64 shrink-0 px-3 py-0.5 text-left border-r border-zinc-800/80 text-[10px] leading-5 font-mono flex items-center justify-between gap-1.5 transition-colors group ${
                                isHoveredCommit ? "bg-sky-950/60 text-sky-200" : "hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-100"
                              }`}
                              title={
                                lineBlame?.commit
                                  ? `${lineBlame.commit.messageHeadline || "No message"}\n\nAuthor: ${lineBlame.commit.author?.name || lineBlame.commit.author?.login || "Unknown"}\nDate: ${formatDate(lineBlame.commit.committedDate)}\nSHA: ${lineBlame.commit.oid}\n\nClick to inspect commit details`
                                  : "No blame data available for this line"
                              }
                            >
                              <div className="flex items-center gap-1.5 min-w-0 truncate">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRangeHeader ? "bg-sky-400" : "bg-zinc-600"}`} />
                                <span className={`truncate text-[10px] ${isRangeHeader ? "font-medium text-zinc-200" : "text-zinc-400 opacity-80"}`}>
                                  {lineBlame?.commit?.author?.login || lineBlame?.commit?.author?.name || "Unknown"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {lineBlame?.commit?.committedDate && (
                                  <span className="text-[9px] text-zinc-500 group-hover:text-zinc-400">
                                    {formatTimeAgo(lineBlame.commit.committedDate)}
                                  </span>
                                )}
                                {lineBlame?.commit?.abbreviatedOid ? (
                                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-sky-400/90 group-hover:border-sky-500/50">
                                    {lineBlame.commit.abbreviatedOid}
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-zinc-600">-</span>
                                )}
                              </div>
                            </button>
                          )}
                          <span className="select-none w-12 shrink-0 text-right pr-3 text-zinc-600 font-mono text-[10px] leading-5 pt-0.5">
                            {lineNumber}
                          </span>
                          <code
                            className={`whitespace-pre px-3 text-[11px] leading-5 language-${fileLang}`}
                            dangerouslySetInnerHTML={{ __html: highlightLine(line, fileLang) }}
                          />
                        </div>
                      );
                    })}
                    <div style={{ height: codeWindow.bottom }} aria-hidden="true" />
                  </div>
                ) : <div className="p-8 text-xs text-zinc-500">No file selected.</div>}
              </div>
            </div>

            {data.file?.path && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Symbols</div>
                  <div className="mt-2 space-y-1 max-h-36 overflow-auto">
                    {fileSymbols.length ? fileSymbols.map((symbol: any, idx: number) => (
                      <button key={`sym_${symbol.id}_${idx}`} type="button" onClick={() => document.getElementById(`code-line-${symbol.line || 1}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="w-full text-left rounded-lg px-2 py-1 text-[10px] font-mono hover:bg-zinc-100 dark:hover:bg-zinc-900">
                        {symbol.symbol} <span className="text-zinc-400">L{symbol.line || 1}</span>
                      </button>
                    )) : <div className="text-xs text-zinc-400">No symbol-level evidence for this file.</div>}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Dependencies</div>
                  <div className="mt-2 space-y-1 max-h-36 overflow-auto">
                    {fileDependencies.length ? fileDependencies.map((node: any, idx: number) => <button key={`dep_${node.id}_${idx}`} type="button" onClick={() => setAiContext({ type: "node", label: node.label, path: node.filePath })} className="w-full text-left rounded-lg px-2 py-1 text-[10px] font-mono hover:bg-zinc-100 dark:hover:bg-zinc-900 truncate">{node.label}</button>) : <div className="text-xs text-zinc-400">No recorded import relationship.</div>}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Dependents</div>
                  <div className="mt-2 space-y-1 max-h-36 overflow-auto">
                    {fileDependents.length ? fileDependents.map((node: any, idx: number) => <button key={`dependents_${node.id}_${idx}`} type="button" onClick={() => setAiContext({ type: "node", label: node.label, path: node.filePath })} className="w-full text-left rounded-lg px-2 py-1 text-[10px] font-mono hover:bg-zinc-100 dark:hover:bg-zinc-900 truncate">{node.label}</button>) : <div className="text-xs text-zinc-400">No recorded dependent relationship.</div>}
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
                <div className="min-w-0"><button type="button" onClick={() => void openCommit(c.sha)} className="text-left font-medium text-sm hover:underline">{c.commit?.message?.split("\n")[0]}</button><div className="mt-2 text-[11px] text-zinc-400">{c.commit?.author?.name || c.author?.login} · {formatDate(c.commit?.author?.date || c.commit?.committer?.date)}</div></div>
                <div className="text-right shrink-0"><div className="font-mono text-[10px] text-zinc-400">{c.sha?.slice(0, 8)}</div><div className="mt-1 flex items-center gap-2">
                  <button type="button" onClick={() => void analyzeChange({ sha: c.sha, question: "Analyze what changed in this commit, what it affects, and what I should investigate next." })} className="text-[10px] text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Analyze</button>
                  <a className="text-[10px] text-zinc-400 hover:text-zinc-900 dark:hover:text-white" href={c.html_url} target="_blank" rel="noreferrer">GitHub</a>
                </div></div>
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

      {commitDetail && (
        <div className="fixed inset-y-4 right-4 z-50 w-[min(760px,calc(100vw-2rem))] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono">Commit</div>
              <div className="text-sm font-semibold truncate">{commitDetail.commit?.commit?.message?.split("\n")[0] || commitDetail.commit?.sha}</div>
            </div>
            <button type="button" onClick={() => setCommitDetail(null)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"><X className="w-4 h-4" /></button>
          </div>
          <div className="max-h-[calc(100vh-2rem)] overflow-auto p-4 space-y-4">
            {commitDetail.commit && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                  <span>{commitDetail.commit.commit?.author?.name || commitDetail.commit.author?.login || "Unknown"}</span>
                  <span>·</span>
                  <span>{formatDate(commitDetail.commit.commit?.author?.date || commitDetail.commit.commit?.committer?.date)}</span>
                  <span>·</span>
                  <span className="font-mono">{commitDetail.commit.sha?.slice(0, 12)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3"><div className="text-[9px] uppercase tracking-wider text-zinc-400">Files</div><div className="mt-1 text-lg font-semibold">{commitDetail.commit.stats?.total ?? commitDetail.commit.files?.length ?? 0}</div></div>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3"><div className="text-[9px] uppercase tracking-wider text-zinc-400">Additions</div><div className="mt-1 text-lg font-semibold">{commitDetail.commit.stats?.additions ?? 0}</div></div>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3"><div className="text-[9px] uppercase tracking-wider text-zinc-400">Deletions</div><div className="mt-1 text-lg font-semibold">{commitDetail.commit.stats?.deletions ?? 0}</div></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void analyzeChange({ sha: commitDetail.commit.sha, question: "Analyze this commit from an architectural, dependency, historical, and potential-impact perspective using only repository evidence." })} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs">
                    <Sparkles className="w-3.5 h-3.5" /> Change Analysis
                  </button>
                  {commitDetail.commit.html_url && <a href={commitDetail.commit.html_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">GitHub <ExternalLink className="w-3.5 h-3.5" /></a>}
                </div>
                <div className="space-y-2">
                  {(commitDetail.commit.files || []).map((file: any) => (
                    <div key={file.filename} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                      <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-3">
                        <span className="font-mono text-[10px] truncate">{file.filename}</span>
                        <span className="shrink-0 text-[10px] text-zinc-400">+{file.additions || 0} / -{file.deletions || 0}</span>
                      </div>
                      {file.patch && <pre className="max-h-64 overflow-auto p-3 bg-zinc-950 text-[9px] leading-4 text-zinc-200 whitespace-pre-wrap">{file.patch}</pre>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
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
