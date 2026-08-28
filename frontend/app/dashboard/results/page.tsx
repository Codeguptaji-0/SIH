"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  HelpCircle,
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          {/* Header Banner */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-blue-600 font-bold uppercase">
                Assessment Results &amp; Gap Diagnosis
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
                Competency Evaluation Summary
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {assessedOn
                  ? `Latest scored attempt: ${assessedOn}`
                  : 'Categorised into Strong, Needs Improvement and Critical Gap'}
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

              {hasResults && (
                <div className="flex items-center space-x-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">
                      Overall Score
                    </div>
                    <div className="text-3xl font-black text-slate-900">
                      {results.overall_score}%
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-bold">
                    <Award className="w-6 h-6" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {loading && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your assessment results...
            </div>
          )}

          {!loading && error && (
            <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4" /> Could not load your results
              </div>
              <p className="text-xs text-rose-700 font-mono break-words">{error}</p>
              <p className="text-xs text-rose-700">
                No scores or gap diagnostics are displayed, because none were received.
              </p>
            </div>
          )}

          {!loading && !error && !hasResults && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <div className="w-12 h-12 mx-auto bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No scored assessment yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Gap diagnostics are generated from a submitted assessment. Complete an assessment and
                your per-competency scores and the evidence behind them will appear here.
              </p>
              <Link
                href="/dashboard/assessment"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow transition-all"
              >
                Go to Assessment Center <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {!loading && !error && hasResults && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600" /> Transparent Gap Diagnostics
              </h3>

              <div className="grid grid-cols-1 gap-4">
                {compList.map((item, idx) => {
                  const isGap = item.status === 'critical_gap';
                  const isImprove = item.status === 'needs_improvement';
                  return (
                    <div
                      key={item.competency_id || idx}
                      className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        isGap
                          ? 'bg-rose-50/60 border-rose-200'
                          : isImprove
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-emerald-50/60 border-emerald-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          {item.status ? (
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${
                                isGap
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : isImprove
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          ) : null}
                          {item.domain ? (
                            <span className="text-[11px] text-slate-500 font-mono">{item.domain}</span>
                          ) : null}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{item.competency_name}</h4>
                        {item.evidence ? (
                          <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            {item.evidence}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            No evidence text was returned for this competency.
                          </p>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-extrabold text-slate-900">{item.score}%</div>
                        <div className="text-[10px] text-slate-400 font-medium">Competency Score</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && !error && hasResults && (
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold">Ready to bridge these gaps?</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Your learning path is built from the competencies flagged above, using the
                  available iGOT Karmayogi / NSSTA TPAC catalogue entries.
                </p>
              </div>
              <Link
                href="/dashboard/learning-path"
                className="bg-blue-500 hover:bg-blue-400 text-white text-xs font-extrabold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2 flex-shrink-0"
              >
                View Personalised Training Path <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
