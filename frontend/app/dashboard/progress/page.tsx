"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { ApiError, apiJson } from '@/app/lib/api';

/**
 * Competency Progress Tracker.
 *
 * The previous version of this page contained no fetch call whatsoever: the
 * metric cards, the before/after bar chart and the "Domain Improvement Ledger"
 * were literal constants, so it reported a confident +29 point improvement even
 * with the backend stopped. Everything rendered below now comes from the API.
 *
 * Sources:
 *   GET /api/competency/me   -> { attempt_id, overall_score, completed_at, competencies[] }
 *   GET /api/recommendations -> { learning_path: [...] }
 *
 * Note on the chart: /api/competency/me returns only the *latest* attempt, so
 * there is no stored baseline series to plot against. Inventing one is what the
 * old page did. Instead the chart plots measured current scores and the page
 * states plainly that trend data is not available yet.
 */

/* -- Response shapes, matching the FastAPI routers exactly -- */

interface CompetencyRow {
  competency_id?: string;
  competency_name?: string;
  domain?: string;
  score?: number;
  status?: string;
  priority?: number;
  evidence?: string;
}

interface CompetencyResponse {
  attempt_id?: string;
  overall_score?: number;
  completed_at?: string;
  competencies?: CompetencyRow[];
}

interface PathItem {
  id?: string;
  status?: string;
}

/** Surfaces the backend's own `detail` text so a real failure is visible. */
function describeError(e: unknown): string {
  if (e instanceof ApiError) return `${e.message} (HTTP ${e.status})`;
  return 'Cannot reach the SkillSetu backend. Start it with: uvicorn app.main:app --reload';
}

const STATUS_BADGE: Record<string, string> = {
  strong: 'border-strong-200 bg-strong-50 text-strong-700',
  needs_improvement: 'border-watch-200 bg-watch-50 text-watch-700',
  critical_gap: 'border-gap-200 bg-gap-50 text-gap-700',
};

/* Chart inks, matching the tokens in tailwind.config.js. */
const INK_RULE = '#D9D7CE';
const INK_SLATE = '#5A6472';
const INK_NAVY = '#1B3A6B';

export default function ProgressTrackerPage() {
  const [competency, setCompetency] = useState<CompetencyResponse>(null);
  const [competencyError, setCompetencyError] = useState<string>(null);
  const [path, setPath] = useState<PathItem[]>(null);
  const [pathError, setPathError] = useState<string>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setCompetencyError(null);
    setPathError(null);

    // Neither call should hide the other's result, so both are awaited and their
    // failures are reported independently.
    const [compResult, pathResult] = await Promise.allSettled([
      apiJson<CompetencyResponse>('/api/competency/me'),
      apiJson<{ learning_path?: PathItem[] }>('/api/recommendations'),
    ]);

    if (compResult.status === 'fulfilled') {
      setCompetency(compResult.value);
    } else {
      setCompetency(null);
      setCompetencyError(describeError(compResult.reason));
    }

    if (pathResult.status === 'fulfilled') {
      setPath(pathResult.value?.learning_path || []);
    } else {
      setPath(null);
      setPathError(describeError(pathResult.reason));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const competencies: CompetencyRow[] = competency?.competencies || [];
  const hasAttempt = competencies.length > 0;
  const criticalGaps = competencies.filter((c) => c.status === 'critical_gap').length;
  const strongAreas = competencies.filter((c) => c.status === 'strong').length;

  // Only competencies the backend actually scored are plotted.
  const chartData = competencies
    .filter((c) => typeof c.score === 'number')
    .map((c) => ({
      name: c.competency_name || c.competency_id || 'Unnamed competency',
      current: c.score,
    }));

  const pathItems: PathItem[] = path || [];
  const completedItems = pathItems.filter((i) => i.status === 'COMPLETED').length;
  const totalItems = pathItems.length;
  const completionPercent = totalItems
    ? Math.round((completedItems / totalItems) * 1000) / 10
    : null;

  const assessedOn = competency?.completed_at
    ? new Date(competency.completed_at).toLocaleString()
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-8">
          <header className="flex items-end justify-between gap-4 border-b-2 border-ink pb-6">
            <div>
              <p className="eyebrow">Progress tracker</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
                Competency progress
              </h1>
              <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
                Proficiency as measured by your most recent scored assessment attempt. Nothing on
                this page is estimated.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 border border-rule-strong bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </header>

          <div className="mt-8 space-y-8">

          {loading && (
            <div className="flex items-center justify-center gap-3 border border-rule bg-white px-5 py-10 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your competency
              data…
            </div>
          )}

          {!loading && competencyError && (
            <div role="alert" className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-ink">Could not load competency scores</h2>
                <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{competencyError}</p>
                <p className="mt-1.5 text-xs text-gap-700">
                  No scores are shown because none were received.
                </p>
              </div>
            </div>
          )}

          {!loading && !competencyError && !hasAttempt && (
            <div className="border border-rule bg-white px-5 py-6">
              <h2 className="text-sm font-medium text-ink">No assessment attempts recorded yet</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                Competency scores are derived from scored attempts. Complete an assessment and your
                per-competency scores and gaps appear here.
              </p>
              <Link
                href="/dashboard/assessment"
                className="mt-4 inline-flex h-11 items-center border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
              >
                Go to assessment centre
              </Link>
            </div>
          )}

          {!loading && !competencyError && hasAttempt && (
            <>
              <div className="grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-3">
                <div className="bg-white px-4 py-4">
                  <p className="eyebrow">Overall score</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-ink tnum">
                    {typeof competency.overall_score === 'number'
                      ? `${competency.overall_score}%`
                      : '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {assessedOn ? `Attempt of ${assessedOn}` : 'Latest scored attempt'}
                  </p>
                </div>
                <div className="bg-white px-4 py-4">
                  <p className="eyebrow">Strong competencies</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-strong-700 tnum">
                    {strongAreas}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    of {competencies.length} assessed
                  </p>
                </div>
                <div className="bg-white px-4 py-4">
                  <p className="eyebrow">Critical gaps</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-gap-700 tnum">
                    {criticalGaps}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Flagged by the scoring engine</p>
                </div>
              </div>

              {chartData.length > 0 && (
                <figure className="m-0">
                  <figcaption className="mb-3">
                    <p className="eyebrow">Current score by competency</p>
                    <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                      Measured scores from attempt{' '}
                      <span className="font-mono text-[11px] text-ink">{competency.attempt_id}</span>.
                      No baseline-versus-current trend is drawn: the API returns only the latest
                      attempt, so there is no earlier score to compare against.
                    </p>
                  </figcaption>
                  <div className="border border-rule bg-white p-4">
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke={INK_RULE} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fill: INK_SLATE }}
                            stroke={INK_RULE}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 10, fill: INK_SLATE }}
                            stroke={INK_RULE}
                          />
                          <Tooltip
                            contentStyle={{
                              border: `1px solid ${INK_RULE}`,
                              borderRadius: 2,
                              boxShadow: 'none',
                              fontSize: 12,
                            }}
                          />
                          <Bar
                            dataKey="current"
                            name="Current score (%)"
                            fill={INK_NAVY}
                            barSize={18}
                            isAnimationActive={false}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </figure>
              )}

              <section>
                <div className="border-b border-ink pb-2.5">
                  <p className="eyebrow">Per-competency detail</p>
                  <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                    Band and evidence exactly as the scoring engine recorded them.
                  </p>
                </div>
                <ol className="m-0 mt-1 list-none p-0">
                  {competencies.map((row, idx) => (
                    <li key={row.competency_id || idx} className="border-b border-rule py-3.5">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium text-ink">
                            {row.competency_name || 'Competency name not returned'}
                          </h3>
                          {row.domain ? <p className="eyebrow mt-1">{row.domain}</p> : null}
                        </div>
                        <div className="flex shrink-0 items-baseline gap-3">
                          {row.status ? (
                            <span
                              className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${
                                STATUS_BADGE[row.status] || 'border-rule bg-paper-sunken text-slate-500'
                              }`}
                            >
                              {row.status.replace(/_/g, ' ')}
                            </span>
                          ) : null}
                          <span className="font-display text-lg font-semibold text-ink tnum">
                            {typeof row.score === 'number' ? `${row.score}%` : '—'}
                          </span>
                        </div>
                      </div>
                      {row.evidence ? (
                        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-600">
                          {row.evidence}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}

          {!loading && (
            <section className="border border-rule bg-white px-5 py-5">
              <p className="eyebrow">Assigned learning path progress</p>

              {pathError ? (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-3.5 py-3"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gap-600" aria-hidden="true" />
                  <div className="min-w-0">
                    <h3 className="text-xs font-medium text-ink">Could not load your learning path</h3>
                    <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{pathError}</p>
                  </div>
                </div>
              ) : totalItems === 0 ? (
                <p className="mt-2.5 max-w-xl text-xs leading-relaxed text-slate-500">
                  No learning path items are assigned yet, so there is no completion figure to show.{' '}
                  <Link
                    href="/dashboard/learning-path"
                    className="text-navy-600 underline decoration-navy-200 underline-offset-4 hover:decoration-navy-600"
                  >
                    Open learning path
                  </Link>
                </p>
              ) : (
                <>
                  <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-3">
                    <p className="text-sm text-ink tnum">
                      {completedItems} of {totalItems} assigned item
                      {totalItems === 1 ? '' : 's'} completed
                    </p>
                    <p className="font-display text-2xl font-semibold text-ink tnum">
                      {completionPercent !== null ? `${completionPercent}%` : '—'}
                    </p>
                  </div>
                  <div className="mt-3 h-[6px] w-full bg-paper-sunken" aria-hidden="true">
                    <div
                      className="h-full bg-navy-600"
                      style={{ width: `${Math.max(0, Math.min(100, completionPercent || 0))}%` }}
                    />
                  </div>
                  <p className="mt-2.5 text-[11px] leading-relaxed text-slate-400">
                    Course completion is tracked separately from competency scores, which are
                    recalculated only from assessment attempts.
                  </p>
                </>
              )}
            </section>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
