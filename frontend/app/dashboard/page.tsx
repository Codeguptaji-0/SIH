"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { CompetencyRadar } from '@/components/CompetencyRadar';
import { VirtualAssistantWidget } from '@/components/VirtualAssistantWidget';
import { Award, AlertTriangle, CheckCircle, ArrowRight, BookOpen, Clock, RefreshCw } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" userName={fullName || undefined} />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-3xl shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-blue-400 font-bold uppercase tracking-wider mb-1">
                {t('overviewHeader')}
              </div>
              {loading ? (
                <>
                  <div className="h-8 w-64 bg-slate-700/60 rounded animate-pulse" />
                  <div className="h-3 w-80 bg-slate-700/40 rounded animate-pulse mt-2" />
                </>
              ) : profileError && !isMissing(profileError) ? (
                <>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t('welcomeUser')}</h1>
                  <p className="text-xs text-rose-300 mt-1">Profile could not be loaded: {profileError.message}</p>
                </>
              ) : isMissing(profileError) ? (
                <>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t('welcomeUser')}</h1>
                  <p className="text-xs text-slate-300 mt-1">
                    No profile data recorded yet.{' '}
                    <Link href="/dashboard/profile" className="text-blue-300 underline">
                      Complete your profile
                    </Link>{' '}
                    so recommendations can be targeted to your role.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {t('welcomeUser')}{fullName ? `, ${fullName}` : ''}
                  </h1>
                  <p className="text-xs text-slate-300 mt-1">
                    {t('jobRole')}: <span className="font-semibold text-white">{designation || 'Not set'}</span> • Department: <span className="font-semibold text-white">{department || 'Not set'}</span>
                  </p>
                  {profileIncomplete && (
                    <p className="text-[11px] text-amber-300 mt-1">
                      Some profile fields are empty.{' '}
                      <Link href="/dashboard/profile" className="underline">
                        Complete your profile
                      </Link>
                      .
                    </p>
                  )}
                </>
              )}
            </div>
            <Link
              href="/dashboard/quiz/active-quiz-session-001"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-600/30 text-xs flex items-center gap-2 transition-all"
            >
              {t('startAssessment')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Assessment summary: loading, failed, empty, or real numbers. */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-[104px] animate-pulse" />
              ))}
            </div>
          ) : competencyError && !isMissing(competencyError) ? (
            <div role="alert" className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-slate-900">Competency scores unavailable</div>
                <p className="text-xs text-rose-700 mt-1">{competencyError.message}</p>
              </div>
            </div>
          ) : !hasScores ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="text-sm font-bold text-slate-900">No assessment recorded yet</div>
              <p className="text-xs text-slate-500 mt-1">
                Competency scores and gap analysis appear here once you complete an assessment.
              </p>
            </div>
          ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Overall Score</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {overallScore !== null ? `${overallScore}%` : '—'}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-1">Target: 80% Baseline</div>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Strong Areas</div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-1">{strongCount}</div>
                <div className="text-[10px] text-slate-400 mt-1">Score ≥ 80%</div>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Needs Improvement</div>
                <div className="text-2xl font-extrabold text-amber-600 mt-1">{improvementCount}</div>
                <div className="text-[10px] text-slate-400 mt-1">Score 60% – 79%</div>
              </div>
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold">
                <RefreshCw className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Critical Gaps</div>
                <div className="text-2xl font-extrabold text-rose-600 mt-1">{gapCount}</div>
                <div className="text-[10px] text-rose-600 font-semibold mt-1">High Priority Training Needed</div>
              </div>
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center font-bold">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Competency Radar & Charts */}
          <CompetencyRadar data={competencies} />
          </>
          )}

          {/* Active Learning Path Preview */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Your Recommended Learning Pathway</h3>
                <p className="text-xs text-slate-500">Prioritized courses from iGOT Karmayogi & NSSTA TPAC catalogs</p>
              </div>
              <Link href="/dashboard/learning-path" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                View Full Path <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Real recommendations from GET /api/recommendations. This block used
                to render three hardcoded courses, which looked like an assigned
                pathway even for a user with no assessment history. */}
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : pathError ? (
              <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3.5">
                Recommendations could not be loaded: {pathError.message}
              </p>
            ) : learningPath.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                No courses recommended yet. Complete an assessment and a pathway will be generated from
                your competency gaps.
              </p>
            ) : (
              <div className="space-y-3">
                {learningPath.map((item, idx) => (
                  <div key={item.id || idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{item.course_title}</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <span className="font-medium text-slate-600">{item.provider || 'Provider not set'}</span>
                          {item.estimated_duration && (
                            <>
                              •
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {item.estimated_duration}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {item.status && (
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        item.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <VirtualAssistantWidget />
    </div>
  );
}
