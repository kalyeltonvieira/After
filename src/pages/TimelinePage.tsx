import React, { useState } from "react";
import {
  History,
  GitCommit,
  Plus,
  Search,
  Filter,
  User,
  Calendar,
  Layers,
  ArrowRight,
  X,
} from "lucide-react";
import { useProject } from "../context/ProjectContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { ProjectEvent } from "../types";
import { EmptyState } from "../components/EmptyState";

export function TimelinePage() {
  const { events, addEvent, currentProject } = useProject();
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const [search, setSearch] = useState("");
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Form State for logging a new rationale event
  const [eventTitle, setEventTitle] = useState("");
  const [actor, setActor] = useState(profile?.username || user?.displayName?.toLowerCase().replace(/\s+/g, ".") || "author");
  const [reason, setReason] = useState("");
  const [affectedComponents, setAffectedComponents] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [loading, setLoading] = useState(false);

  if (!currentProject) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <EmptyState
          title={t("empty_no_project_title")}
          description={t("empty_no_project_desc")}
        />
      </div>
    );
  }

  const filteredEvents = events.filter((ev) => {
    const q = search.toLowerCase();
    return (
      ev.event.toLowerCase().includes(q) ||
      ev.actor.toLowerCase().includes(q) ||
      ev.reason.toLowerCase().includes(q) ||
      ev.affectedComponents.some((c) => c.toLowerCase().includes(q))
    );
  });

  const handleAddEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const compList = affectedComponents
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      await addEvent({
        event: eventTitle,
        actor,
        timestamp: "Just now",
        affectedComponents: compList.length > 0 ? compList : ["Core System"],
        reason,
        metadata: commitHash ? { commit: commitHash } : {},
      });

      setIsLogModalOpen(false);
      setEventTitle("");
      setReason("");
      setAffectedComponents("");
      setCommitHash("");
    } catch (err) {
      console.error("Failed to add timeline event:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/70 dark:border-zinc-850">
        <div>
          <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono mb-1">
            <span>{t("timeline_ledger")}</span>
            <span>•</span>
            <span>{currentProject?.name}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t("timeline_title")}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {t("timeline_subtitle")}
          </p>
        </div>

        <button
          id="log-decision-btn"
          type="button"
          onClick={() => setIsLogModalOpen(true)}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("timeline_log_btn")}</span>
        </button>
      </div>

      {events.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-4 max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t("timeline_empty_title")}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
            {t("timeline_empty_desc")}
          </p>
          <button
            type="button"
            onClick={() => setIsLogModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("timeline_log_btn")}</span>
          </button>
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex items-center space-x-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("timeline_search_placeholder")}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
          </div>

          {/* Vertical Timeline */}
          <div className="relative pl-6 border-l border-zinc-200/80 dark:border-zinc-800 space-y-8 ml-2">
            {filteredEvents.length === 0 ? (
              <div className="text-xs text-zinc-500 py-8">No historical events match your query.</div>
            ) : (
              filteredEvents.map((ev, idx) => (
                <div key={ev.id || idx} className="relative group">
                  {/* Bullet Node */}
                  <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-zinc-950 border-2 border-zinc-900 dark:border-zinc-100 group-hover:scale-125 transition-transform" />

                  <div className="p-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-zinc-400 font-mono">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          @{ev.actor}
                        </span>
                        {ev.metadata?.commit && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">
                            commit {ev.metadata.commit}
                          </span>
                        )}
                      </div>
                      <span>{ev.timestamp}</span>
                    </div>

                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {ev.event}
                    </h3>

                    {ev.reason && (
                      <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-xs">
                        <span className="font-semibold text-zinc-500 uppercase text-[10px] tracking-wider block mb-0.5">
                          Rationale Recorded
                        </span>
                        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-serif italic">
                          "{ev.reason}"
                        </p>
                      </div>
                    )}

                    {ev.affectedComponents && ev.affectedComponents.length > 0 && (
                      <div className="pt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                        <span>Affected:</span>
                        {ev.affectedComponents.map((c, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Log Rationale Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setIsLogModalOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 z-50">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {t("timeline_modal_title")}
              </h3>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEventSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t("timeline_event_title_label")}
                </label>
                <input
                  type="text"
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder={language === "pt" ? "ex: Mudança no tempo de expiração da sessão para 14 dias" : "e.g. Switched auth session timeout to 14 days"}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t("timeline_why_label")}
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={language === "pt" ? "Explique por que esta decisão foi tomada e que problema ela resolveu..." : "Explain why this decision was made and what problem it solved..."}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t("timeline_affected_label")}
                </label>
                <input
                  type="text"
                  value={affectedComponents}
                  onChange={(e) => setAffectedComponents(e.target.value)}
                  placeholder={language === "pt" ? "Auth Gateway, Session Provider, coleção users" : "Auth Gateway, Session Provider, users collection"}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {t("timeline_actor_label")}
                  </label>
                  <input
                    type="text"
                    required
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {t("timeline_commit_label")}
                  </label>
                  <input
                    type="text"
                    value={commitHash}
                    onChange={(e) => setCommitHash(e.target.value)}
                    placeholder="e.g. 7f2a1b"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer"
                >
                  {language === "pt" ? "Cancelar" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 cursor-pointer"
                >
                  {loading ? (language === "pt" ? "Gravando..." : "Recording...") : t("timeline_save_btn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
