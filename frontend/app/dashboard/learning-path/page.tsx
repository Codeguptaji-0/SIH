"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { ApiError, apiJson } from '@/app/lib/api';

/**
 * Personalised learning path.
 *
 * Previously this page fell back to a four-course hardcoded roadmap whenever
 * /api/recommendations returned nothing usable (including on a 401 or with the
 * backend down), and its "mark complete" handler optimistically flipped the row
 * to COMPLETED regardless of what the server did.
 *
 * Now:
 *   GET  /api/recommendations                     -> { learning_path: [...] }
 *   POST /api/recommendations/{item_id}/complete  -> { status, item_id, item_status,
 *          completed_items, total_items, completion_percent, message }
 *        and 404 when the item does not belong to the signed-in user - which is
 *        surfaced as an error instead of being swallowed.
 *
 * Items may arrive with status NO_COURSE_MAPPED and null course_id / provider /
 * estimated_duration. Those are real identified gaps with nothing in the
 * catalogue mapped to them yet, so they are rendered as muted cards rather than
 * filtered out.
 */

interface PathItem {
  id?: string;
  course_id?: string;
  course_title?: string;
  competency_name?: string;
  provider?: string;
  priority?: string;
  estimated_duration?: string;
  status?: string;
}

/** Exactly the progress block the completion endpoint returns. */
interface CompletionProgress {
  completed_items?: number;
  total_items?: number;
  completion_percent?: number;
  message?: string;
}

function describeError(e: unknown): string {
  if (e instanceof ApiError) return `${e.message} (HTTP ${e.status})`;
  return 'Cannot reach the SkillSetu backend. Start it with: uvicorn app.main:app --reload';
}

/** An item with no catalogue course behind it. */
function isUnmapped(item: PathItem): boolean {
  return item.status === 'NO_COURSE_MAPPED' || !item.course_id;
}

export default function LearningPathPage() {
  const [learningPath, setLearningPath] = useState<PathItem[]>(null);
  const [error, setError] = useState<string>(null);
  const [loading, setLoading] = useState(true);

  // Progress as reported by the completion endpoint. Null until the server has
  // told us; until then the counts below are derived from the fetched statuses.
  const [progress, setProgress] = useState<CompletionProgress>(null);

  // Per-item failure text, so a 404 is visible on the row that caused it.
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [pendingItem, setPendingItem] = useState<string>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setItemErrors({});
    setProgress(null);
    try {
      const data = await apiJson<{ learning_path?: PathItem[] }>('/api/recommendations');
      setLearningPath(data?.learning_path || []);
    } catch (e) {
      setLearningPath(null);
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Mark one item complete.
   *
   * The row is only updated from the server's `item_status`; a 404 (item not
   * owned by this user, or unknown id) leaves the row exactly as it was and
   * shows the backend's message.
   */
  const handleComplete = useCallback(async (itemId: string) => {
    if (!itemId) return;
    setPendingItem(itemId);
    setItemErrors((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    try {
      const res = await apiJson<CompletionProgress & { item_id?: string; item_status?: string }>(
        `/api/recommendations/${encodeURIComponent(itemId)}/complete`,
        { method: 'POST' }
      );

      setLearningPath((prev) =>
        (prev || []).map((item) =>
          item.id === itemId ? { ...item, status: res?.item_status || item.status } : item
        )
      );

      setProgress({
        completed_items: res?.completed_items,
        total_items: res?.total_items,
        completion_percent: res?.completion_percent,
        message: res?.message,
      });
    } catch (e) {
      setItemErrors((prev) => ({ ...prev, [itemId]: describeError(e) }));
    } finally {
      setPendingItem(null);
    }
  }, []);

  const items: PathItem[] = learningPath || [];
  const hasItems = items.length > 0;

  // Server figures win once we have them; before that, counts come from the
  // statuses the API actually returned - never from a guess.
  const completedCount =
    typeof progress?.completed_items === 'number'
      ? progress.completed_items
      : items.filter((i) => i.status === 'COMPLETED').length;
  const totalCount =
    typeof progress?.total_items === 'number' ? progress.total_items : items.length;
  const percent =
    typeof progress?.completion_percent === 'number'
      ? progress.completion_percent
      : totalCount
      ? Math.round((completedCount / totalCount) * 1000) / 10
      : null;
  const unmappedCount = items.filter(isUnmapped).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Your Personalised Learning Path</h1>
              <p className="text-xs text-slate-500 mt-1">
                Built from the competency gaps in your latest assessment, matched against the
                iGOT Karmayogi / NSSTA TPAC catalogue entries available to this instance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <div className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-200 font-mono font-bold">
                Simulated iGOT Ecosystem Integration
              </div>
            </div>
          </div>

          {loading && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your learning path...
            </div>
          )}

          {!loading && error && (
            <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4" /> Could not load your learning path
              </div>
              <p className="text-xs text-rose-700 font-mono break-words">{error}</p>
              <p className="text-xs text-rose-700">
                No courses are listed, because none were received from the server.
              </p>
            </div>
          )}

          {!loading && !error && !hasItems && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <div className="w-12 h-12 mx-auto bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No learning path assigned yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                A path is generated from the gaps found in a scored assessment. Complete an
                assessment first and your recommended courses will be listed here.
              </p>
              <Link
                href="/dashboard/assessment"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow transition-all"
              >
                Go to Assessment Center <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {!loading && !error && hasItems && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  {completedCount} of {totalCount} items completed
                </span>
                <span className="font-extrabold text-blue-600">{percent}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${percent || 0}%` }}
                />
              </div>
              {progress?.message ? (
                <p className="text-[11px] text-slate-500">{progress.message}</p>
              ) : null}
              {unmappedCount > 0 ? (
                <p className="text-[11px] text-amber-700">
                  {unmappedCount} identified gap{unmappedCount === 1 ? '' : 's'} currently{' '}
                  {unmappedCount === 1 ? 'has' : 'have'} no mapped catalogue course.
                </p>
              ) : null}
            </div>
          )}

          {!loading && !error && hasItems && (
            <div className="space-y-4 relative">
              {items.map((item, idx) => {
                const unmapped = isUnmapped(item);
                const isDone = item.status === 'COMPLETED';
                const isInProgress = item.status === 'IN_PROGRESS';
                const rowError = item.id ? itemErrors[item.id] : null;

                return (
                  <div
                    key={item.id || idx}
                    className={`p-6 rounded-2xl border transition-all shadow-sm ${
                      unmapped
                        ? 'bg-slate-100/70 border-dashed border-slate-300'
                        : isDone
                        ? 'bg-emerald-50/20 border-emerald-200'
                        : isInProgress
                        ? 'bg-white border-blue-400 ring-2 ring-blue-100'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start space-x-4">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                            unmapped
                              ? 'bg-slate-200 text-slate-500'
                              : isDone
                              ? 'bg-emerald-600 text-white'
                              : isInProgress
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isDone ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            {item.priority ? (
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono ${
                                  item.priority === 'High'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {item.priority} Priority
                              </span>
                            ) : null}
                            {item.provider ? (
                              <span className="text-[11px] font-bold text-blue-700">{item.provider}</span>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-500 font-mono">
                                No provider
                              </span>
                            )}
                          </div>

                          <h3
                            className={`text-sm font-bold ${
                              unmapped ? 'text-slate-600' : 'text-slate-900'
                            }`}
                          >
                            {item.course_title || 'Untitled item'}
                          </h3>

                          <p className="text-xs text-slate-500">
                            Competency:{' '}
                            <span className="font-semibold text-slate-700">
                              {item.competency_name || 'Unspecified'}
                            </span>
                            {item.estimated_duration ? (
                              <span className="inline-flex items-center gap-1 ml-2">
                                <Clock className="w-3 h-3" /> {item.estimated_duration}
                              </span>
                            ) : null}
                          </p>

                          {unmapped ? (
                            <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 inline-block">
                              No mapped course yet - gap recorded
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 flex-shrink-0">
                        {unmapped ? (
                          <span className="text-xs font-bold text-slate-500 bg-slate-200/70 px-3 py-1.5 rounded-xl border border-slate-300">
                            Awaiting catalogue mapping
                          </span>
                        ) : isDone ? (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300">
                            Completed
                          </span>
                        ) : (
                          <button
                            onClick={() => handleComplete(item.id)}
                            disabled={pendingItem === item.id || !item.id}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition-all flex items-center gap-1.5"
                          >
                            {pendingItem === item.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving
                              </>
                            ) : (
                              <>
                                Mark Complete <ExternalLink className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {rowError ? (
                      <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                          <AlertTriangle className="w-3.5 h-3.5" /> Could not mark this item complete
                        </div>
                        <p className="text-[11px] text-rose-700 font-mono break-words">{rowError}</p>
                        <p className="text-[11px] text-rose-700">
                          The item was left unchanged.
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center pt-4">
            <Link
              href="/dashboard/progress"
              className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Track Competency Score Progress <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
