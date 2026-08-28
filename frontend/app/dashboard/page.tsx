"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { CompetencyRadar } from '@/components/CompetencyRadar';
import { VirtualAssistantWidget } from '@/components/VirtualAssistantWidget';
import { AlertTriangle, ArrowRight, Clock } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';
import { ApiError, apiJson } from '@/app/lib/api';

interface ProfileData {
  full_name?: string;
  designation?: string;
  department?: string;
}

interface CompetencyRow {
  competency_name: string;
  domain: string;
  score: number;
  status?: string;
  priority?: string;
}

interface LearningPathItem {
  id: string;
  course_title: string;
  provider: string;
  priority?: string;
  estimated_duration?: string;
  status?: string;
}

/** A failed request, described well enough to show the user what went wrong. */
interface Failure {
  message: string;
  status: number | null;
}

/**
 * Turn a rejected apiJson call into something displayable.
 *
 * ApiError carries the backend's `detail` string, so the user sees the real
 * reason (expired session, missing profile row) instead of a blank panel.
 */
function toFailure(reason: unknown): Failure {
  if (reason instanceof ApiError) return { message: reason.message, status: reason.status };
  return {
    message: 'Cannot reach the SkillSetu backend. Start it with: uvicorn app.main:app --reload',
    status: null,
  };
}

/** 404 means "nothing recorded yet", which is an empty state, not an error. */
const isMissing = (f: Failure | null) => f?.status === 404;

function roundVal(val: number) {
  return Math.round(val * 10) / 10;
}

export default function OfficialDashboard() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [competencies, setCompetencies] = useState<CompetencyRow[]>([]);
  const [learningPath, setLearningPath] = useState<LearningPathItem[]>([]);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [profileError, setProfileError] = useState<Failure | null>(null);
  const [competencyError, setCompetencyError] = useState<Failure | null>(null);
  const [pathError, setPathError] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  /**
   * Load the dashboard.
   *
   * These calls previously used apiFetch(...).then(res => res.json()) with no
   * res.ok check, so a 401 or 500 JSON body was written straight into state and
   * the page fell back to hardcoded competency scores. apiJson throws ApiError on
   * any non-2xx, so a failure is now recorded as a failure and rendered as one.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [profileRes, competencyRes, pathRes] = await Promise.allSettled([
        apiJson<ProfileData>('/api/profile/me'),
        apiJson<{ competencies?: CompetencyRow[]; overall_score?: number }>('/api/competency/me'),
        apiJson<{ learning_path?: LearningPathItem[] }>('/api/recommendations'),
      ]);

      if (cancelled) return;

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value);
      } else {
        setProfileError(toFailure(profileRes.reason));
      }

      if (competencyRes.status === 'fulfilled') {
        const rows = Array.isArray(competencyRes.value?.competencies) ? competencyRes.value.competencies : [];
        setCompetencies(rows);
        const reported = competencyRes.value?.overall_score;
        if (rows.length > 0) {
          setOverallScore(
            typeof reported === 'number' && reported > 0
              ? roundVal(reported)
              : roundVal(rows.reduce((acc, curr) => acc + curr.score, 0) / rows.length)
          );
        }
      } else {
        setCompetencyError(toFailure(competencyRes.reason));
      }

      if (pathRes.status === 'fulfilled') {
        setLearningPath(Array.isArray(pathRes.value?.learning_path) ? pathRes.value.learning_path : []);
      } else {
        setPathError(toFailure(pathRes.reason));
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const strongCount = competencies.filter((c) => c.score >= 80).length;
  const improvementCount = competencies.filter((c) => c.score >= 60 && c.score < 80).length;
  const gapCount = competencies.filter((c) => c.score < 60).length;

  // Empty string is how the backend reports "not recorded", so treat it as missing.
  const value = (v?: string) => (v && v.trim() ? v.trim() : null);
  const fullName = value(profile?.full_name);
  const designation = value(profile?.designation);
  const department = value(profile?.department);
  const profileIncomplete = !loading && !profileError && (!fullName || !designation || !department);
  const hasScores = competencies.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* currentRole is no longer forced to OFFICIAL - the bar reports the role
          on the session, so it cannot claim one that is not there. */}
      <Navbar userName={fullName || undefined} />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-8">
          {/* Release header, ruled rather than a gradient banner. */}
          <header className="flex flex-col justify-between gap-5 border-b-2 border-ink pb-6 md:flex-row md:items-end">
            <div className="min-w-0">
              <p className="eyebrow">{t('overviewHeader')}</p>
              {loading ? (
                <>
                  <div className="mt-2 h-8 w-64 animate-pulse bg-paper-sunken" />
                  <div className="mt-2 h-3 w-80 animate-pulse bg-paper-sunken" />
                </>
              ) : profileError && !isMissing(profileError) ? (
                <>
                  <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                    {t('welcomeUser')}
                  </h1>
                  <p className="mt-1.5 text-xs text-gap-700">
                    Profile could not be loaded: {profileError.message}
                  </p>
                </>
              ) : isMissing(profileError) ? (
                <>
                  <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                    {t('welcomeUser')}
                  </h1>
                  <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
                    No profile data recorded yet.{' '}
                    <Link href="/dashboard/profile" className="text-navy-600 underline underline-offset-2">
                      Complete your profile
                    </Link>{' '}
                    so recommendations can be targeted to your role.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink sm:text-3xl">
                    {t('welcomeUser')}
                    {fullName ? `, ${fullName}` : ''}
                  </h1>
                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                    <div className="flex gap-1.5">
                      <dt className="text-slate-400">{t('jobRole')}</dt>
                      <dd className="font-medium text-ink">{designation || 'Not set'}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-slate-400">Department</dt>
                      <dd className="font-medium text-ink">{department || 'Not set'}</dd>
                    </div>
                  </dl>
                  {profileIncomplete && (
                    <p className="mt-1.5 text-[11px] text-watch-700">
                      Some profile fields are empty.{' '}
                      <Link href="/dashboard/profile" className="underline underline-offset-2">
                        Complete your profile
                      </Link>
                      .
                    </p>
                  )}
                </>
              )}
            </div>
            {/*
             * This used to link to /dashboard/quiz/active-quiz-session-001, a
             * session id compiled into the page. Opening it asked the backend for
             * a session that does not exist. It now goes to the assessment page,
             * which creates a real session before any question is shown.
             */}
            <Link
              href="/dashboard/assessment"
              className="inline-flex h-11 shrink-0 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
            >
              {t('startAssessment')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </header>

          {/* Assessment summary: loading, failed, empty, or real numbers. */}
          <section className="mt-9">
            <p className="eyebrow">Assessment summary</p>
            <div className="mt-3">
          {loading ? (
            <div className="h-[104px] animate-pulse border border-rule bg-paper-sunken" />
          ) : competencyError && !isMissing(competencyError) ? (
            <div
              role="alert"
              className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div>
                <div className="text-sm font-medium text-ink">Competency scores unavailable</div>
                <p className="mt-1 text-xs text-gap-700">{competencyError.message}</p>
              </div>
            </div>
          ) : !hasScores ? (
            <div className="border border-rule bg-white px-5 py-6">
              <div className="text-sm font-medium text-ink">No assessment recorded yet</div>
              <p className="mt-1 max-w-lg text-xs leading-relaxed text-slate-500">
                Competency scores and gap analysis appear here once you complete an assessment.
              </p>
            </div>
          ) : (
            <>
              {/*
               * Four figures, separated by rules rather than boxed in cards. The
               * icon badges beside each number are gone: a figure set this large
               * does not need a decorative glyph next to it.
               */}
              <div className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
                {[
                  {
                    label: 'Overall score',
                    value: overallScore !== null ? `${overallScore}%` : '—',
                    note: 'Baseline 80%',
                    cls: 'text-ink',
                  },
                  { label: 'Strong areas', value: strongCount, note: 'Score 80 and above', cls: 'text-strong-700' },
                  { label: 'Needs improvement', value: improvementCount, note: 'Score 60 to 79', cls: 'text-watch-700' },
                  { label: 'Critical gaps', value: gapCount, note: 'Score below 60', cls: 'text-gap-700' },
                ].map((f) => (
                  <div key={f.label} className="bg-white px-4 py-4">
                    <p className="eyebrow">{f.label}</p>
                    <p className={`mt-2 font-display text-3xl font-semibold tnum ${f.cls}`}>{f.value}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{f.note}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <CompetencyRadar data={competencies} />
              </div>
            </>
          )}
            </div>
          </section>

          {/* Active learning path preview. */}
          <section className="mt-9">
            <div className="flex items-end justify-between gap-4 border-b border-ink pb-2.5">
              <div>
                <p className="eyebrow">Recommended learning path</p>
                <p className="mt-1.5 text-xs text-slate-500">
                  Ordered by gap severity, drawn from iGOT Karmayogi and NSSTA TPAC
                </p>
              </div>
              <Link
                href="/dashboard/learning-path"
                className="flex shrink-0 items-center gap-1 text-xs font-medium text-navy-600 underline decoration-navy-200 underline-offset-4 hover:decoration-navy-600"
              >
                Full path <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {/* Real recommendations from GET /api/recommendations. This block used
                to render three hardcoded courses, which looked like an assigned
                pathway even for a user with no assessment history. */}
            {loading ? (
              <div className="mt-4 h-24 animate-pulse bg-paper-sunken" />
            ) : pathError ? (
              <p role="alert" className="mt-4 border-l-2 border-gap-600 bg-gap-50 px-4 py-3 text-xs text-gap-700">
                Recommendations could not be loaded: {pathError.message}
              </p>
            ) : learningPath.length === 0 ? (
              <p className="mt-4 max-w-xl border-l-2 border-rule-strong bg-paper-sunken px-4 py-3 text-xs leading-relaxed text-slate-500">
                No courses recommended yet. Complete an assessment and a pathway will be generated
                from your competency gaps.
              </p>
            ) : (
              <ol className="m-0 mt-1 list-none p-0">
                {learningPath.map((item, idx) => (
                  <li
                    key={item.id || idx}
                    className="flex flex-col items-start justify-between gap-2 border-b border-rule py-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 items-baseline gap-3">
                      <span className="font-mono text-[11px] text-slate-400 tnum">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-ink">{item.course_title}</h3>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
                          <span>{item.provider || 'Provider not set'}</span>
                          {item.estimated_duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" aria-hidden="true" /> {item.estimated_duration}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {item.status && (
                      <span
                        className={`shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${
                          item.status === 'IN_PROGRESS'
                            ? 'border-watch-200 bg-watch-50 text-watch-700'
                            : 'border-rule bg-paper-sunken text-slate-500'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </main>
      </div>

      <VirtualAssistantWidget />
    </div>
  );
}
