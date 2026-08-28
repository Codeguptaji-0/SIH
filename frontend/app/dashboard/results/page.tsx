"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { ApiError, apiJson } from '@/app/lib/api';

/**
 * Assessment results / gap diagnosis.
 *
 * This page used to call apiFetch(...).then(res => res.json()) without checking
 * res.ok, and fell back to a five-entry hardcoded competency list. A 401 or a
 * stopped backend therefore rendered five confident scores with invented
 * evidence sentences. All of that is gone: the only source is
 *
 *   GET /api/competency/me -> { attempt_id, overall_score, completed_at, competencies[] }
 *
 * and a failed or empty response renders an explicit error / empty state.
 */

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

function describeError(e: unknown): string {
  if (e instanceof ApiError) return `${e.message} (HTTP ${e.status})`;
  return 'Cannot reach the SkillSetu backend. Start it with: uvicorn app.main:app --reload';
}

/**
 * Band for one competency row.
 *
 * The backend's `status` is authoritative when it is present; the score-based
 * thresholds are only a fallback so a row without a status still gets a band
 * instead of silently rendering as strong.
 */
function bandOf(status?: string, score?: number) {
  const s = typeof score === 'number' ? score : 0;
  if (status === 'critical_gap' || (!status && s < 60)) {
    return {
      label: 'Critical gap',
      edge: 'border-l-gap-600',
      cls: 'text-gap-700',
      chip: 'border-gap-200 bg-gap-50 text-gap-700',
    };
  }
  if (status === 'needs_improvement' || (!status && s < 80)) {
    return {
      label: 'Needs improvement',
      edge: 'border-l-watch-500',
      cls: 'text-watch-700',
      chip: 'border-watch-200 bg-watch-50 text-watch-700',
    };
  }
  return {
    label: 'Strong',
    edge: 'border-l-strong-600',
    cls: 'text-strong-700',
    chip: 'border-strong-200 bg-strong-50 text-strong-700',
  };
}

export default function ResultsPage() {
  const [results, setResults] = useState<CompetencyResponse>(null);
  const [error, setError] = useState<string>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<CompetencyResponse>('/api/competency/me');
      setResults(data);
    } catch (e) {
      setResults(null);
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const compList: CompetencyRow[] = results?.competencies || [];
  const hasResults = compList.length > 0;
  const assessedOn = results?.completed_at
    ? new Date(results.completed_at).toLocaleString()
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-8">
          <header className="flex flex-col justify-between gap-5 border-b-2 border-ink pb-6 md:flex-row md:items-end">
            <div className="min-w-0">
              <p className="eyebrow">Assessment results and gap diagnosis</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
                Competency evaluation summary
              </h1>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                {assessedOn
                  ? `Latest scored attempt: ${assessedOn}`
                  : 'Each competency is placed in one of three bands: strong, needs improvement, critical gap.'}
              </p>
            </div>

            <div className="flex shrink-0 items-end gap-5">
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 border border-rule-strong bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                Refresh
              </button>

              {hasResults && typeof results.overall_score === 'number' && (
                <div>
                  <p className="eyebrow">Overall score</p>
                  <p className="mt-1 font-display text-4xl font-semibold text-ink tnum">
                    {results.overall_score}%
                  </p>
                </div>
              )}
            </div>
          </header>

          <div className="mt-8 space-y-8">

          {loading && (
            <div className="flex items-center justify-center gap-3 border border-rule bg-white px-5 py-10 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your assessment
              results…
            </div>
          )}

          {!loading && error && (
            <div role="alert" className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-ink">Could not load your results</h2>
                <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{error}</p>
                <p className="mt-1.5 text-xs text-gap-700">
                  No scores or gap diagnostics are shown, because none were received.
                </p>
              </div>
            </div>
          )}

          {!loading && !error && !hasResults && (
            <div className="border border-rule bg-white px-5 py-6">
              <h2 className="text-sm font-medium text-ink">No scored assessment yet</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                Gap diagnostics are generated from a submitted assessment. Complete one and your
                per-competency scores, with the evidence behind each, appear here.
              </p>
              <Link
                href="/dashboard/assessment"
                className="mt-4 inline-flex h-11 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
              >
                Go to assessment centre <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}

          {!loading && !error && hasResults && (
            <section>
              <div className="border-b border-ink pb-2.5">
                <p className="eyebrow">Gap diagnostics</p>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                  One entry per assessed competency, with the evidence the scoring engine recorded
                  for it. Scores are arithmetic over your answers, not a model's opinion.
                </p>
              </div>

              <ol className="m-0 mt-1 list-none p-0">
                {compList.map((item, idx) => {
                  const band = bandOf(item.status, item.score);
                  return (
                    <li
                      key={item.competency_id || idx}
                      className={`flex flex-col justify-between gap-3 border-b border-rule border-l-2 py-4 pl-4 pr-1 sm:flex-row sm:items-baseline ${band.edge}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span
                            className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${band.chip}`}
                          >
                            {item.status ? item.status.replace(/_/g, ' ') : band.label}
                          </span>
                          {item.domain ? <span className="eyebrow">{item.domain}</span> : null}
                        </div>
                        <h3 className="mt-1.5 text-sm font-medium text-ink">
                          {item.competency_name || 'Competency name not returned'}
                        </h3>
                        {item.evidence ? (
                          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
                            {item.evidence}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-400">
                            No evidence text was returned for this competency.
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <p className={`font-display text-2xl font-semibold tnum ${band.cls}`}>
                          {typeof item.score === 'number' ? `${item.score}%` : '—'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Competency score</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                Bands: 80 and above is strong, 60 to 79 needs improvement, below 60 is a critical gap.
              </p>
            </section>
          )}

          {!loading && !error && hasResults && (
            <section className="flex flex-col justify-between gap-4 border border-ink bg-white px-5 py-5 sm:flex-row sm:items-end">
              <div className="min-w-0">
                <p className="eyebrow">Next step</p>
                <h2 className="mt-2 font-display text-lg font-semibold tracking-tight text-ink">
                  Bridge these gaps
                </h2>
                <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
                  Your learning path is ordered by the shortfalls above and drawn from the available
                  iGOT Karmayogi and NSSTA TPAC catalogue entries.
                </p>
              </div>
              <Link
                href="/dashboard/learning-path"
                className="inline-flex h-11 shrink-0 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
              >
                View training path <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
