"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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

/* Chart inks, matching the tokens in tailwind.config.js. */
const INK_RULE = '#D9D7CE';
const INK_SLATE = '#5A6472';
const INK_NAVY = '#1B3A6B';

/* Band ink for a 0-100 figure: 80 and above strong, 60 to 79 watch, below 60 a gap. */
function bandInk(score: number) {
  if (score >= 80) return 'text-strong-700';
  if (score >= 60) return 'text-watch-700';
  return 'text-gap-700';
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  /*
   * No session check here any more. app/admin/layout.tsx wraps this segment in
   * RequireAuth allow={['ADMIN']}, which does not render children until a
   * session is confirmed, so this page only mounts for a signed-in ADMIN and
   * the fetch below cannot fire unauthenticated. The real gate remains
   * require_role("ADMIN") on the FastAPI admin router.
   */
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar role="ADMIN" />

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-8">
          <header className="flex items-end justify-between gap-4 border-b-2 border-ink pb-6">
            <div>
              <p className="eyebrow">DIID executive dashboard</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
                Department Aggregate Analytics
              </h1>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                Organization-wide skill readiness aggregated from recorded assessment attempts.
                Every figure below is returned by GET /api/admin/analytics; counters may
                legitimately be 0 and collections may be empty.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAnalytics}
              disabled={loading}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 border border-rule-strong bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </header>

          <div className="mt-8 space-y-8">
            {loading && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-center gap-3 border border-rule bg-white px-5 py-10 text-xs text-slate-500"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading department analytics…
              </div>
            )}

            {!loading && error && (
              <div role="alert" className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className="text-sm font-medium text-ink">Analytics could not be loaded</h2>
                  <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{error}</p>
                  <button
                    type="button"
                    onClick={fetchAnalytics}
                    className="mt-3 inline-flex h-11 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && !hasAnyData && (
              <div className="border border-rule bg-white px-5 py-6">
                <h2 className="text-sm font-medium text-ink">No assessment data recorded yet</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                  Readiness, skill gaps and course demand are all computed from completed assessment
                  attempts. Once officials complete assessments against trainer-approved questions,
                  aggregates will appear here.
                </p>
              </div>
            )}

            {!loading && !error && hasAnyData && (
              <>
                {/* Key Admin KPIs - all four are direct query results and may be 0 */}
                <div className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
                  <div className="bg-white px-4 py-4">
                    <p className="eyebrow">Total officials</p>
                    <p className="mt-2 font-display text-3xl font-semibold text-ink tnum">
                      {totalOfficials}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">Registered OFFICIAL accounts</p>
                  </div>

                  <div className="bg-white px-4 py-4">
                    <p className="eyebrow">Assessments completed</p>
                    <p className="mt-2 font-display text-3xl font-semibold text-ink tnum">
                      {completedCount}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {participationRate !== null
                        ? `${participationRate}% participation rate`
                        : 'Participation rate unavailable'}
                    </p>
                  </div>

                  <div className="bg-white px-4 py-4">
                    <p className="eyebrow">Average competency</p>
                    <p
                      className={`mt-2 font-display text-3xl font-semibold tnum ${
                        completedCount > 0 ? bandInk(avgCompetency) : 'text-ink'
                      }`}
                    >
                      {completedCount > 0 ? `${avgCompetency}%` : '—'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {completedCount > 0
                        ? `Mean of ${completedCount} recorded attempt(s)`
                        : 'No attempts recorded'}
                    </p>
                  </div>

                  <div className="bg-white px-4 py-4">
                    <p className="eyebrow">Critical skill gaps</p>
                    <p
                      className={`mt-2 font-display text-3xl font-semibold tnum ${
                        criticalGaps > 0 ? 'text-gap-700' : 'text-ink'
                      }`}
                    >
                      {criticalGaps}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Competency results flagged critical
                    </p>
                  </div>
                </div>

                {/* Domain readiness and period-over-period movement */}
                {domainData.length === 0 ? (
                  <div className="border-l-2 border-rule-strong bg-paper-sunken px-4 py-3 text-xs leading-relaxed text-slate-500">
                    No competency results have been recorded, so no domain readiness can be computed
                    yet.
                  </div>
                ) : (
                  <div className="space-y-8">
                    <figure className="m-0">
                      <figcaption className="mb-3">
                        <p className="eyebrow">Domain readiness &amp; 7-day movement</p>
                        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                          Average competency score per domain, with the last 7 days compared against
                          the 7 days before. This is a comparison of two past windows, not a
                          forecast.
                        </p>
                      </figcaption>
                      <div className="overflow-x-auto border border-rule bg-white">
                        <table className="table-release min-w-[36rem]">
                          <thead>
                            <tr>
                              <th scope="col">Domain</th>
                              <th scope="col" className="num">Readiness</th>
                              <th scope="col">7-day movement</th>
                            </tr>
                          </thead>
                          <tbody>
                            {domainData.map((d) => (
                              <tr key={d.domain}>
                                <th scope="row" className="text-left align-baseline font-normal text-ink">
                                  {d.domain}
                                </th>
                                <td className={`num font-medium ${bandInk(d.readiness)}`}>
                                  {d.readiness}%
                                </td>
                                <td>
                                  <TrendBadge trend={d.trend} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </figure>

                    <figure className="m-0">
                      <figcaption className="mb-3">
                        <p className="eyebrow">Readiness index by domain</p>
                        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                          The same figures as the table above, plotted on a 0 to 100 scale.
                        </p>
                      </figcaption>
                      <div className="border border-rule bg-white p-4">
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={domainData}
                              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid vertical={false} stroke={INK_RULE} />
                              <XAxis
                                dataKey="domain"
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
                                dataKey="readiness"
                                name="Readiness Index (%)"
                                fill={INK_NAVY}
                                barSize={28}
                                isAnimationActive={false}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </figure>
                  </div>
                )}

                {/* Top gaps and course demand, each honest about being empty */}
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  <figure className="m-0">
                    <figcaption className="mb-3">
                      <p className="eyebrow">Top department skill gaps</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                        Competencies flagged as critical, as returned in top_gaps.
                      </p>
                    </figcaption>
                    {topGaps.length === 0 ? (
                      <div className="border-l-2 border-rule-strong bg-paper-sunken px-4 py-3 text-xs leading-relaxed text-slate-500">
                        No competency has been flagged as a critical gap yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-rule bg-white">
                        <table className="table-release min-w-[24rem]">
                          <thead>
                            <tr>
                              <th scope="col">Competency</th>
                              <th scope="col" className="num">Gap</th>
                              <th scope="col" className="num">Officials affected</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topGaps.map((g, idx) => (
                              <tr key={`${g.competency}-${idx}`}>
                                <th scope="row" className="text-left align-baseline font-normal text-ink">
                                  {g.competency}
                                </th>
                                <td className="num font-medium text-gap-700">
                                  {typeof g.gap_percentage === 'number' ? `${g.gap_percentage}%` : '—'}
                                </td>
                                <td className="num">{g.officials_affected}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </figure>

                  <figure className="m-0">
                    <figcaption className="mb-3">
                      <p className="eyebrow">Capacity building course demand</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                        Officials enrolled per course, counted from assigned learning paths.
                      </p>
                    </figcaption>
                    {trainingDemand.length === 0 ? (
                      <div className="border-l-2 border-rule-strong bg-paper-sunken px-4 py-3 text-xs leading-relaxed text-slate-500">
                        No learning paths have been assigned yet, so there is no course demand to
                        report.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-rule bg-white">
                        <table className="table-release min-w-[24rem]">
                          <thead>
                            <tr>
                              <th scope="col">Course</th>
                              <th scope="col">Provider</th>
                              <th scope="col" className="num">Enrolled</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trainingDemand.map((d, idx) => (
                              <tr key={`${d.course_title}-${idx}`}>
                                <th scope="row" className="text-left align-baseline font-normal text-ink">
                                  {d.course_title}
                                </th>
                                <td className="text-slate-500">{d.provider || '—'}</td>
                                <td className="num">{d.enrolled_officials}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </figure>
                </div>
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

/* Status chip: one shape for every movement label, band colours carry the meaning. */
const CHIP = 'inline-block whitespace-nowrap border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow';

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
    return <span className={`${CHIP} border-strong-200 bg-strong-50 text-strong-700`}>Trending up</span>;
  }
  if (trend === 'trending_down') {
    return <span className={`${CHIP} border-gap-200 bg-gap-50 text-gap-700`}>Action needed</span>;
  }
  if (trend === 'stable') {
    return <span className={`${CHIP} border-navy-200 bg-navy-50 text-navy-700`}>Stable</span>;
  }
  return (
    <span
      title="Two comparable 7-day windows of attempts are needed before a direction can be shown."
      className={`${CHIP} border-rule bg-paper-sunken text-slate-500`}
    >
      Not enough data
    </span>
  );
}
