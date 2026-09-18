import React, { useEffect, useMemo, useState } from "react";
import { GitBranch, FileCode2, GitCommit, GitPullRequest, CircleDot, Package, Users, Search, Plus, Eye, ExternalLink, RefreshCw } from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { authenticatedHeaders } from "../lib/api";
import { EmptyState } from "../components/EmptyState";

type Tab = "code" | "branches" | "commits" | "pulls" | "issues" | "releases" | "contributors";

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function RepositoryPage() {
  const { currentProject, setAiContext, setIsAskAfterOpen } = useProject();
  const [tab, setTab] = useState<Tab>("code");
  const [data, setData] = useState<any>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const projectId = currentProject?.id;
  const tabs = useMemo(() => [
    ["code", FileCode2, "Code"],
    ["branches", GitBranch, "Branches"],
    ["commits", GitCommit, "Commits"],
    ["pulls", GitPullRequest, "Pull Requests"],
    ["issues", CircleDot, "Issues"],
    ["releases", Package, "Releases"],
    ["contributors", Users, "Contributors"],
  ] as const, []);

  const request = async (path: string, init?: RequestInit) => {
    const res = await fetch(path, { ...init, headers: { ...(await authenticatedHeaders()), ...(init?.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  };

  const loadTab = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const q = encodeURIComponent(projectId);
      if (tab === "code") setData((await request(`/api/repository/tree?projectId=${q}`)));
      if (tab === "branches") setData((await request(`/api/repository/branches?projectId=${q}`)));
      if (tab === "commits") setData((await request(`/api/repository/commits?projectId=${q}&per_page=50`)));
      if (tab === "pulls") setData((await request(`/api/repository/pulls?projectId=${q}&state=all&per_page=50`)));
      if (tab === "issues") setData((await request(`/api/repository/issues?projectId=${q}&state=all&per_page=50`)));
      if (tab === "releases") setData((await request(`/api/repository/releases?projectId=${q}&per_page=50`)));
      if (tab === "contributors") setData((await request(`/api/repository/contributors?projectId=${q}&per_page=50`)));
    } catch (error) {
      setData({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTab(); setSelectedFile(null); setSearch(""); }, [projectId, tab]);

  if (!currentProject) {
    return <div className="p-8 max-w-4xl mx-auto"><EmptyState title="No repository connected" description="Connect a GitHub repository to browse its real code and history." /></div>;
  }

  const openFile = async (path: string) => {
    setSelectedFile(path);
    try {
      const body = await request(`/api/repository/file?projectId=${encodeURIComponent(projectId!)}&path=${encodeURIComponent(path)}`);
      setData((prev: any) => ({ ...prev, file: body }));
      setAiContext({
        type: "file",
        label: path,
        path,
        content: typeof body.content === "string" ? body.content.slice(0, 24000) : undefined,
      });
    } catch (error) {
      setData((prev: any) => ({ ...prev, file: null, error: error instanceof Error ? error.message : String(error) }));
    }
  };

  const createBranch = async () => {
    const name = window.prompt("New branch name");
    if (!name) return;
    try {
      await request("/api/repository/branches", {
        method: "POST",
        body: JSON.stringify({ projectId, name, from: currentProject.defaultBranch || currentProject.branch }),
      });
      await loadTab();
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

  const createPull = async () => {
    const title = window.prompt("Pull request title");
    const head = window.prompt("Head branch");
    const base = window.prompt("Base branch", currentProject.defaultBranch || currentProject.branch);
    if (!title || !head || !base) return;
    const body = window.prompt("Pull request description") || "";
    try {
      await request("/api/repository/pulls", { method: "POST", body: JSON.stringify({ projectId, title, head, base, body }) });
      await loadTab();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const toggleWatch = async () => {
    try {
      const existing = await request(`/api/repository/watch?projectId=${encodeURIComponent(projectId!)}`);
      const watched = Array.isArray(existing.watchTargets) && existing.watchTargets.length > 0;
      await request("/api/repository/watch", { method: "POST", body: JSON.stringify({ projectId, enabled: !watched }) });
      await loadTab();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const tree = (data.tree || []).filter((item: any) => item.type === "blob" && String(item.path).toLowerCase().includes(search.toLowerCase())).slice(0, 300);
  const branches = data.branches || [];
  const commits = data.commits || [];
  const pulls = data.pulls || [];
  const issues = data.issues || [];
  const releases = data.releases || [];
  const contributors = data.contributors || [];

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 border-b border-zinc-200/70 dark:border-zinc-800 pb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono">Repository</div>
            <h1 className="text-2xl font-semibold tracking-tight">{currentProject.repository}</h1>
            <p className="text-xs text-zinc-500 mt-1">Branch: {currentProject.branch} · {currentProject.language} · {currentProject.framework}</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files…" className="bg-transparent outline-none text-xs flex-1" />
            </div>
            <div className="max-h-[65vh] overflow-auto p-2">
              {tree.map((item: any) => <button key={item.path} onClick={() => openFile(item.path)} className={`w-full text-left px-3 py-2 rounded-lg font-mono text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800 ${selectedFile === item.path ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}>{item.path}</button>)}
              {tree.length === 0 && <p className="p-6 text-center text-xs text-zinc-400">No source file matched.</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="font-mono text-xs truncate">{data.file?.path || "Select a file"}</div>
              {data.file?.path && (
                <button
                  type="button"
                  onClick={() => setIsAskAfterOpen(true)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[11px] font-medium hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Ask AFTER
                </button>
              )}
            </div>
            <pre className="max-h-[65vh] overflow-auto p-4 text-[11px] leading-relaxed"><code>{data.file?.content || "No file selected."}</code></pre>
          </div>
        </div>
      )}

      {!loading && tab === "branches" && <div className="space-y-3">{<button onClick={createBranch} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs"><Plus className="w-3.5 h-3.5" /> Create branch</button>}{branches.map((b: any) => <div key={b.name} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs"><span className="font-mono">{b.name}</span><span className="text-zinc-400">{b.commit?.sha?.slice(0, 10)}</span></div>)}</div>}

      {!loading && tab === "commits" && <div className="space-y-3">{commits.map((c: any) => <div key={c.sha} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800"><div className="flex justify-between gap-3"><span className="font-medium text-sm">{c.commit?.message?.split("\n")[0]}</span><span className="font-mono text-[10px] text-zinc-400">{c.sha?.slice(0, 8)}</span></div><div className="mt-2 text-[11px] text-zinc-400">{c.commit?.author?.name || c.author?.login} · {formatDate(c.commit?.author?.date || c.commit?.committer?.date)}</div></div>)}</div>}

      {!loading && tab === "pulls" && <div className="space-y-3">{<button onClick={createPull} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs"><Plus className="w-3.5 h-3.5" /> Open pull request</button>}{pulls.map((p: any) => <div key={p.id} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800"><div className="flex justify-between gap-3"><span className="text-sm font-medium">#{p.number} {p.title}</span><span className="text-[10px] uppercase text-zinc-400">{p.state}</span></div><div className="mt-2 text-[11px] text-zinc-400">{p.user?.login} · {p.head?.ref} → {p.base?.ref}</div></div>)}</div>}

      {!loading && tab === "issues" && <div className="space-y-3">{<button onClick={createIssue} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs"><Plus className="w-3.5 h-3.5" /> Create issue</button>}{issues.map((i: any) => <div key={i.id} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800"><div className="flex justify-between gap-3"><span className="text-sm font-medium">#{i.number} {i.title}</span><span className="text-[10px] uppercase text-zinc-400">{i.state}</span></div><div className="mt-2 text-[11px] text-zinc-400">{i.user?.login} · {formatDate(i.updated_at)}</div></div>)}</div>}

      {!loading && tab === "releases" && <div className="space-y-3">{releases.map((r: any) => <div key={r.id} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800"><div className="text-sm font-medium">{r.name || r.tag_name}</div><div className="mt-1 text-[11px] text-zinc-400">{r.tag_name} · {formatDate(r.published_at || r.created_at)}</div></div>)}{releases.length === 0 && <p className="text-xs text-zinc-400">No releases recorded.</p>}</div>}

      {!loading && tab === "contributors" && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{contributors.map((c: any) => <div key={c.id || c.login} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-3"><img src={c.avatar_url} alt="" className="w-8 h-8 rounded-full" /><div><div className="text-sm font-medium">{c.login}</div><div className="text-[11px] text-zinc-400">{c.contributions} contributions</div></div></div>)}</div>}
    </div>
  );
}
