"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
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
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-8">
          <header className="flex flex-col justify-between gap-4 border-b-2 border-ink pb-6 md:flex-row md:items-end">
            <div className="min-w-0">
              <p className="eyebrow">Recommended training</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
                Your learning path
              </h1>
              <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
                Ordered by the competency gaps in your latest assessment and matched against the
                iGOT Karmayogi and NSSTA TPAC catalogue entries available to this instance.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 border border-rule-strong bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                Refresh
              </button>
              <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate-400">
                iGOT integration simulated
              </p>
            </div>
          </header>

          <div className="mt-8 space-y-8">

          {loading && (
            <div className="flex items-center justify-center gap-3 border border-rule bg-white px-5 py-10 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your learning
              path…
            </div>
          )}

          {!loading && error && (
            <div role="alert" className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-ink">Could not load your learning path</h2>
                <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{error}</p>
                <p className="mt-1.5 text-xs text-gap-700">
                  No courses are listed, because none were received from the server.
                </p>
              </div>
            </div>
          )}

          {!loading && !error && !hasItems && (
            <div className="border border-rule bg-white px-5 py-6">
              <h2 className="text-sm font-medium text-ink">No learning path assigned yet</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                A path is generated from the gaps found in a scored assessment. Complete an
                assessment first and the recommended courses appear here, worst gap first.
              </p>
              <Link
                href="/dashboard/assessment"
                className="mt-4 inline-flex h-11 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
              >
                Go to assessment centre <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}

          {!loading && !error && hasItems && (
            <section className="border border-rule bg-white px-5 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="eyebrow">Completion</p>
                  <p className="mt-1.5 text-sm text-ink tnum">
                    {completedCount} of {totalCount} item{totalCount === 1 ? '' : 's'} completed
                  </p>
                </div>
                <p className="font-display text-2xl font-semibold text-ink tnum">
                  {percent !== null ? `${percent}%` : '—'}
                </p>
              </div>
              <div className="mt-3 h-[6px] w-full bg-paper-sunken" aria-hidden="true">
                <div
                  className="h-full bg-navy-600"
                  style={{ width: `${Math.max(0, Math.min(100, percent || 0))}%` }}
                />
              </div>
              {progress?.message ? (
                <p className="mt-2.5 text-[11px] text-slate-500">{progress.message}</p>
              ) : null}
              {unmappedCount > 0 ? (
                <p className="mt-2.5 text-[11px] text-watch-700">
                  {unmappedCount} identified gap{unmappedCount === 1 ? '' : 's'} currently{' '}
                  {unmappedCount === 1 ? 'has' : 'have'} no mapped catalogue course.
                </p>
              ) : null}
            </section>
          )}

          {!loading && !error && hasItems && (
            <section>
              <div className="border-b border-ink pb-2.5">
                <p className="eyebrow">Ordered pathway</p>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                  Sequence follows gap severity. Items with no catalogue course mapped are still
                  listed, because the gap is real even when the course is not there yet.
                </p>
              </div>
              <ol className="m-0 mt-1 list-none p-0">
              {items.map((item, idx) => {
                const unmapped = isUnmapped(item);
                const isDone = item.status === 'COMPLETED';
                const isInProgress = item.status === 'IN_PROGRESS';
                const rowError = item.id ? itemErrors[item.id] : null;

                return (
                  <li
                    key={item.id || idx}
                    className={`border-b border-rule border-l-2 py-4 pl-4 pr-1 ${
                      unmapped
                        ? 'border-l-rule-strong bg-paper-sunken'
                        : isDone
                        ? 'border-l-strong-600'
                        : isInProgress
                        ? 'border-l-navy-600'
                        : 'border-l-transparent'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-baseline">
                      <div className="flex min-w-0 items-baseline gap-3">
                        <span className="font-mono text-[11px] text-slate-400 tnum">
                          {String(idx + 1).padStart(2, '0')}
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            {item.priority ? (
                              <span
                                className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${
                                  item.priority === 'High'
                                    ? 'border-gap-200 bg-gap-50 text-gap-700'
                                    : 'border-watch-200 bg-watch-50 text-watch-700'
                                }`}
                              >
                                {item.priority} priority
                              </span>
                            ) : null}
                            <span className="eyebrow">{item.provider || 'No provider'}</span>
                          </div>

                          <h3
                            className={`mt-1.5 text-sm font-medium ${
                              unmapped ? 'text-slate-500' : 'text-ink'
                            }`}
                          >
                            {item.course_title || 'Untitled item'}
                          </h3>

                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
                            <span>
                              Competency:{' '}
                              <span className="text-ink">{item.competency_name || 'Unspecified'}</span>
                            </span>
                            {item.estimated_duration ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" aria-hidden="true" />{' '}
                                {item.estimated_duration}
                              </span>
                            ) : null}
                          </p>

                          {unmapped ? (
                            <p className="mt-1.5 text-[11px] text-watch-700">
                              No mapped course yet — the gap is recorded and waiting on the catalogue.
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {unmapped ? (
                          <span className="border border-rule bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-eyebrow text-slate-500">
                            Awaiting catalogue mapping
                          </span>
                        ) : isDone ? (
                          <span className="border border-strong-200 bg-strong-50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-eyebrow text-strong-700">
                            Completed
                          </span>
                        ) : (
                          <button
                            onClick={() => handleComplete(item.id)}
                            disabled={pendingItem === item.id || !item.id}
                            className="inline-flex h-9 items-center gap-1.5 border border-navy-600 bg-navy-600 px-4 text-xs font-medium text-paper transition-colors hover:bg-navy-700 disabled:opacity-50"
                          >
                            {pendingItem === item.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{' '}
                                Saving
                              </>
                            ) : (
                              'Mark complete'
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {rowError ? (
                      <div
                        role="alert"
                        className="mt-3 border-l-2 border-gap-600 bg-gap-50 px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-medium text-ink">
                          <AlertTriangle className="h-3.5 w-3.5 text-gap-600" aria-hidden="true" />{' '}
                          Could not mark this item complete
                        </div>
                        <p className="mt-1 break-words font-mono text-[11px] text-gap-700">
                          {rowError}
                        </p>
                        <p className="mt-1 text-[11px] text-gap-700">The item was left unchanged.</p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
              </ol>
            </section>
          )}

          <div className="border-t border-rule pt-4">
            <Link
              href="/dashboard/progress"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-600 underline decoration-navy-200 underline-offset-4 hover:decoration-navy-600"
            >
              Track competency score progress <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}
