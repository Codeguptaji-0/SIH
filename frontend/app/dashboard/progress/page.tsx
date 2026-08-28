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
  Award,
  CheckCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
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
  strong: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  needs_improvement: 'bg-amber-100 text-amber-800 border-amber-300',
  critical_gap: 'bg-rose-100 text-rose-800 border-rose-300',
};

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Competency Progress Tracker</h1>
              <p className="text-xs text-slate-500 mt-1">
                Proficiency measured from your most recent scored assessment attempt
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {loading && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your competency data...
            </div>
          )}

          {!loading && competencyError && (
            <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4" /> Could not load competency scores
              </div>
              <p className="text-xs text-rose-700 font-mono break-words">{competencyError}</p>
              <p className="text-xs text-rose-700">
                No scores are shown because none were received. Nothing on this page is estimated.
              </p>
            </div>
          )}

          {!loading && !competencyError && !hasAttempt && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <div className="w-12 h-12 mx-auto bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No assessment attempts recorded yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Competency scores are derived from scored assessment attempts. Once you complete an
                assessment, your per-competency scores and gaps will appear here.
              </p>
              <Link
                href="/dashboard/assessment"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow transition-all"
              >
                Go to Assessment Center
              </Link>
            </div>
          )}

          {!loading && !competencyError && hasAttempt && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Overall Score</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">
                      {competency.overall_score}%
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {assessedOn ? `Attempt of ${assessedOn}` : 'Latest scored attempt'}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold">
                    <Award className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Strong Competencies</div>
                    <div className="text-2xl font-extrabold text-emerald-600 mt-1">{strongAreas}</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      of {competencies.length} assessed
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Critical Gaps</div>
                    <div className="text-2xl font-extrabold text-rose-600 mt-1">{criticalGaps}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Flagged by the scoring engine</div>
                  </div>
                  <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center font-bold">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {chartData.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" /> Current Score by Competency
                    </h3>
                    <p className="text-xs text-slate-500">
                      Measured scores from attempt {competency.attempt_id}. A baseline-vs-current
                      trend is not shown: the API returns only the latest attempt, so no earlier
                      score exists to compare against.
                    </p>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar
                          dataKey="current"
                          name="Current score (%)"
                          fill="#1d4ed8"
                          radius={[4, 4, 0, 0]}
                          barSize={22}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800">Per-Competency Detail</h3>
                <div className="space-y-3">
                  {competencies.map((row, idx) => (
                    <div
                      key={row.competency_id || idx}
                      className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="font-bold text-slate-800">
                          {row.competency_name}
                          {row.domain ? (
                            <span className="ml-2 font-mono text-[11px] font-normal text-slate-500">
                              {row.domain}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3">
                          {row.status ? (
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono border ${
                                STATUS_BADGE[row.status] || 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {row.status.replace(/_/g, ' ')}
                            </span>
                          ) : null}
                          <span className="font-extrabold text-slate-900">{row.score}%</span>
                        </div>
                      </div>
                      {row.evidence ? (
                        <p className="text-slate-600 leading-relaxed">{row.evidence}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!loading && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Assigned Learning Path Progress</h3>

              {pathError ? (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                    <AlertTriangle className="w-3.5 h-3.5" /> Could not load your learning path
                  </div>
                  <p className="text-xs text-rose-700 font-mono break-words">{pathError}</p>
                </div>
              ) : totalItems === 0 ? (
                <p className="text-xs text-slate-500">
                  No learning path items are assigned yet, so there is no completion figure to show.{' '}
                  <Link href="/dashboard/learning-path" className="font-bold text-blue-600 hover:text-blue-700">
                    Open Learning Path
                  </Link>
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">
                      {completedItems} of {totalItems} assigned items completed
                    </span>
                    <span className="font-extrabold text-blue-600">{completionPercent}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Course completion is tracked separately from competency scores, which are
                    recalculated only from assessment attempts.
                  </p>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
