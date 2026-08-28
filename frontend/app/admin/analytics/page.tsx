"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  Users,
  Award,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  BarChart3,
  Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { apiJson, ApiError } from '../../lib/api';

/**
 * Department aggregate analytics.
 *
 * Nothing on this page is invented. It used to declare 248 officials, 182
 * assessments, a 71.4% average, 37 critical gaps, four readiness percentages,
 * four named skill gaps and four course titles as `||` fallbacks, so a stopped
 * backend or an empty database rendered a busy, confident dashboard describing
 * data that did not exist. The backend no longer substitutes baselines either:
 * every counter can legitimately be 0 and every collection can be empty, which
 * is rendered as an explicit "no data recorded yet" state.
 */

interface Analytics {
  total_officials: number;
  assessments_completed: number;
  average_competency: number;
  critical_gaps_count: number;
  domain_readiness: Record<string, number>;
  domain_trends: Record<string, string> | null;
  top_gaps: Array<{ competency: string; gap_percentage: number; officials_affected: number }>;
  training_demand: Array<{ course_title: string; enrolled_officials: number; provider: string }>;
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, ready } = useAuth();
  const router = useRouter();

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // No unauthenticated retry: the only thing an unauthenticated call can
      // return is a 401 body, which the old code then rendered as data.
      setAnalytics(await apiJson<Analytics>('/api/admin/analytics'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the analytics service.');
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * A visitor without an ADMIN session is sent to the login screen; the
   * backend's require_role("ADMIN") guard is the real gate.
   */
  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }
    fetchAnalytics();
  }, [ready, user?.role, fetchAnalytics, router]);

  const totalOfficials = analytics?.total_officials ?? 0;
  const completedCount = analytics?.assessments_completed ?? 0;
  const avgCompetency = analytics?.average_competency ?? 0;
  const criticalGaps = analytics?.critical_gaps_count ?? 0;

  const domainReadinessObj = analytics?.domain_readiness ?? {};
  const domainTrendsObj = analytics?.domain_trends ?? {};
  const topGaps = analytics?.top_gaps ?? [];
  const trainingDemand = analytics?.training_demand ?? [];

  const domainData = Object.keys(domainReadinessObj).map((key) => ({
    domain: key,
    readiness: domainReadinessObj[key],
    // "insufficient_data" is the honest default: two comparable 7-day windows
    // are required before any direction can be claimed.
    trend: domainTrendsObj[key] ?? 'insufficient_data'
  }));

  // Participation is only meaningful once there is a cadre to divide by.
  const participationRate =
    totalOfficials > 0 ? ((completedCount / totalOfficials) * 100).toFixed(1) : null;

  const hasAnyData =
    completedCount > 0 ||
    totalOfficials > 0 ||
    domainData.length > 0 ||
    topGaps.length > 0 ||
    trainingDemand.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="ADMIN" />

      <div className="flex flex-1">
        <Sidebar role="ADMIN" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6 w-full">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Department Aggregate Analytics</h1>
              <p className="text-xs text-slate-500 mt-1">
                Organization-wide skill readiness aggregated from recorded assessment attempts
              </p>
            </div>
            <div className="bg-purple-100 border border-purple-300 text-purple-800 px-3 py-1 rounded-xl text-xs font-mono font-bold">
              DIID Executive Dashboard
            </div>
          </div>

          {loading && (
            <div
              role="status"
              aria-live="polite"
              className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-sm text-slate-500"
            >
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" aria-hidden="true" />
              Loading department analytics...
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="bg-white p-8 rounded-2xl border border-rose-200 shadow-sm text-center space-y-3"
            >
              <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">Analytics could not be loaded</h2>
              <p className="text-xs text-rose-700 font-mono break-words">{error}</p>
              <button
                type="button"
                onClick={fetchAnalytics}
                className="mt-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && !hasAnyData && (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <BarChart3 className="w-10 h-10 text-slate-400 mx-auto" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">No assessment data recorded yet</h2>
              <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
                Readiness, skill gaps and course demand are all computed from completed assessment
                attempts. Once officials complete assessments against trainer-approved questions,
                aggregates will appear here.
              </p>
              <button
                type="button"
                onClick={fetchAnalytics}
                className="mt-2 px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Refresh
              </button>
            </div>
          )}

          {!loading && !error && hasAnyData && (
            <>
              {/* Key Admin KPIs - all four are direct query results and may be 0 */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Total Officials</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalOfficials}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Registered OFFICIAL accounts</div>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                    <Users className="w-6 h-6" aria-hidden="true" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Assessments Completed</div>
                    <div className="text-2xl font-extrabold text-blue-600 mt-1">{completedCount}</div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-1">
                      {participationRate !== null
                        ? `${participationRate}% participation rate`
                        : 'Participation rate unavailable'}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <Award className="w-6 h-6" aria-hidden="true" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Average Competency</div>
                    <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                      {completedCount > 0 ? `${avgCompetency}%` : '--'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-1">
                      {completedCount > 0
                        ? `Mean of ${completedCount} recorded attempt(s)`
                        : 'No attempts recorded'}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6" aria-hidden="true" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Critical Skill Gaps</div>
                    <div className="text-2xl font-extrabold text-rose-600 mt-1">{criticalGaps}</div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-1">
                      Competency results flagged critical
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" aria-hidden="true" />
                  </div>
                </div>
              </div>

              {/* Domain readiness and period-over-period movement */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Domain Readiness & 7-Day Movement</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Average competency score per domain, with the last 7 days compared against the 7
                    days before. This is a comparison of two past windows, not a forecast.
                  </p>
                </div>

                {domainData.length === 0 ? (
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                    No competency results have been recorded, so no domain readiness can be computed
                    yet.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                      {domainData.map((d) => (
                        <div
                          key={d.domain}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                        >
                          <div className="text-[11px] text-slate-500 font-medium truncate" title={d.domain}>
                            {d.domain}
                          </div>
                          <div className="flex items-center justify-between mt-1 gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">{d.readiness}%</span>
                            <TrendBadge trend={d.trend} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="h-64 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={domainData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="domain" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar
                            dataKey="readiness"
                            name="Readiness Index (%)"
                            fill="#1d4ed8"
                            radius={[6, 6, 0, 0]}
                            barSize={36}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>

              {/* Top gaps and course demand, each honest about being empty */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h2 className="text-sm font-bold text-slate-800">Top Department Skill Gaps</h2>
                  {topGaps.length === 0 ? (
                    <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                      No competency has been flagged as a critical gap yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {topGaps.map((g, idx) => (
                        <div
                          key={`${g.competency}-${idx}`}
                          className="flex items-center justify-between gap-3 p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-xs"
                        >
                          <span className="font-bold text-slate-800">{g.competency}</span>
                          <span className="font-bold text-rose-700 font-mono whitespace-nowrap">
                            {g.officials_affected} Officials
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h2 className="text-sm font-bold text-slate-800">Capacity Building Course Demand</h2>
                  {trainingDemand.length === 0 ? (
                    <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                      No learning paths have been assigned yet, so there is no course demand to report.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {trainingDemand.map((d, idx) => (
                        <div
                          key={`${d.course_title}-${idx}`}
                          className="flex items-center justify-between gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-800">{d.course_title}</div>
                            {d.provider && (
                              <div className="text-[10px] text-blue-700 font-semibold">{d.provider}</div>
                            )}
                          </div>
                          <span className="font-bold text-blue-800 font-mono whitespace-nowrap">
                            {d.enrolled_officials} Enrolled
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>


            </>
          )}

        </main>
      </div>
    </div>
  );
}

/**
 * Movement indicator for a single domain.
 *
 * "insufficient_data" must never render as an upward arrow: it means the two
 * comparison windows did not both contain attempts, so no direction is known.
 * Anything unrecognised falls through to the same neutral treatment rather than
 * defaulting to "stable", which would be a claim the backend did not make.
 */
function TrendBadge({ trend }: { trend: string }) {
  if (trend === 'trending_up') {
    return (
      <span className="flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
        <TrendingUp className="w-3 h-3 text-emerald-600" aria-hidden="true" /> Trending Up
      </span>
    );
  }
  if (trend === 'trending_down') {
    return (
      <span className="flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
        <TrendingDown className="w-3 h-3 text-rose-600" aria-hidden="true" /> Action Needed
      </span>
    );
  }
  if (trend === 'stable') {
    return (
      <span className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
        <Minus className="w-3 h-3 text-blue-500" aria-hidden="true" /> Stable
      </span>
    );
  }
  return (
    <span
      title="Two comparable 7-day windows of attempts are needed before a direction can be shown."
      className="flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap"
    >
      <HelpCircle className="w-3 h-3 text-slate-500" aria-hidden="true" /> Not enough data
    </span>
  );
}

