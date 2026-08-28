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
 * Assessment Center.
 *
 * The old version advertised a fixed "10 Dynamic MCQs covering Survey Design,
 * Sampling, CPI and Python Data Analysis" and, when /api/materials returned
 * nothing (or failed - res.ok was never checked), printed "Default Demo Material
 * Available: Statistical Methods Training Material.pdf". Neither existed.
 *
 * Both panels are now driven by the API:
 *   GET /api/quizzes/active -> { quiz_id, total_questions, questions[],
 *                                approved_pool_size, message }
 *   GET /api/materials      -> [{ id, title, filename, department, page_count,
 *                                status, created_at }]
 *
 * The backend serves only trainer-approved questions, so when the approved pool
 * is empty the start button is withheld and the backend's own explanation shown.
 */

interface ActiveQuiz {
  quiz_id?: string;
  total_questions?: number;
  approved_pool_size?: number;
  message?: string;
}

interface Material {
  id?: string;
  title?: string;
  filename?: string;
  department?: string;
  page_count?: number;
  status?: string;
}

function describeError(e: unknown): string {
  if (e instanceof ApiError) return `${e.message} (HTTP ${e.status})`;
  return 'Cannot reach the SkillSetu backend. Start it with: uvicorn app.main:app --reload';
}

export default function AssessmentCenterPage() {
  const [quiz, setQuiz] = useState<ActiveQuiz>(null);
  const [quizError, setQuizError] = useState<string>(null);
  const [materials, setMaterials] = useState<Material[]>(null);
  const [materialsError, setMaterialsError] = useState<string>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setQuizError(null);
    setMaterialsError(null);

    const [quizResult, materialsResult] = await Promise.allSettled([
      apiJson<ActiveQuiz>('/api/quizzes/active'),
      apiJson<Material[]>('/api/materials'),
    ]);

    if (quizResult.status === 'fulfilled') {
      setQuiz(quizResult.value);
    } else {
      setQuiz(null);
      setQuizError(describeError(quizResult.reason));
    }

    if (materialsResult.status === 'fulfilled') {
      setMaterials(Array.isArray(materialsResult.value) ? materialsResult.value : []);
    } else {
      setMaterials(null);
      setMaterialsError(describeError(materialsResult.reason));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const questionCount = typeof quiz?.total_questions === 'number' ? quiz.total_questions : 0;
  const canStart = questionCount > 0 && !!quiz?.quiz_id;
  const materialList: Material[] = materials || [];

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-8">
          <header className="flex items-end justify-between gap-4 border-b-2 border-ink pb-6">
            <div>
              <p className="eyebrow">Assessment centre</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
                Available assessments
              </h1>
              <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
                Assembled from trainer-approved questions generated from uploaded MoSPI training
                material.
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
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking for available
              assessments…
            </div>
          )}

          {!loading && quizError && (
            <div role="alert" className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-ink">
                  Could not check for an available assessment
                </h2>
                <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{quizError}</p>
              </div>
            </div>
          )}

          {!loading && !quizError && canStart && (
            <section className="border border-ink bg-white">
              <div className="flex flex-col justify-between gap-5 border-b border-rule px-5 py-5 sm:flex-row sm:items-end">
                <div>
                  <p className="eyebrow">Available assessment</p>
                  <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-ink">
                    Competency assessment
                  </h2>
                </div>
                <Link
                  href={`/dashboard/quiz/${encodeURIComponent(quiz.quiz_id)}`}
                  className="inline-flex h-11 shrink-0 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
                >
                  Start assessment <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <dl className="m-0 grid grid-cols-2 gap-px bg-rule sm:grid-cols-3">
                <div className="bg-white px-4 py-4">
                  <dt className="eyebrow">Questions served</dt>
                  <dd className="mt-2 font-display text-3xl font-semibold text-ink tnum">
                    {questionCount}
                  </dd>
                  <p className="mt-1 text-[11px] text-slate-400">All trainer-approved</p>
                </div>
                <div className="bg-white px-4 py-4">
                  <dt className="eyebrow">Approved pool</dt>
                  <dd className="mt-2 font-display text-3xl font-semibold text-ink tnum">
                    {typeof quiz.approved_pool_size === 'number' ? quiz.approved_pool_size : '—'}
                  </dd>
                  <p className="mt-1 text-[11px] text-slate-400">Questions cleared for release</p>
                </div>
                <div className="bg-white px-4 py-4 sm:col-span-1">
                  <dt className="eyebrow">Session</dt>
                  <dd className="mt-2 break-all font-mono text-[11px] text-ink">{quiz.quiz_id}</dd>
                  <p className="mt-1 text-[11px] text-slate-400">Created by the backend</p>
                </div>
              </dl>
            </section>
          )}

          {!loading && !quizError && !canStart && (
            <div className="border border-rule bg-white px-5 py-6">
              <h2 className="text-sm font-medium text-ink">No assessment available yet</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                {quiz?.message ||
                  'The backend reported no trainer-approved questions, so there is nothing to attempt yet.'}
              </p>
              {typeof quiz?.approved_pool_size === 'number' ? (
                <p className="mt-2 font-mono text-[11px] text-slate-400 tnum">
                  Approved question pool size: {quiz.approved_pool_size}
                </p>
              ) : null}
            </div>
          )}

          {/* The fixed-length quiz above serves a set list. The adaptive run instead
              chooses each next question from the officer's last two answers, so it is
              a separate entry point rather than a mode toggle on the same screen. */}
          <section className="border border-rule bg-white">
            <div className="flex flex-col justify-between gap-4 px-5 py-5 sm:flex-row sm:items-end">
              <div className="min-w-0">
                <p className="eyebrow">Alternative route</p>
                <h2 className="mt-2 font-display text-lg font-semibold tracking-tight text-ink">
                  Adaptive assessment
                </h2>
                <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
                  Starts at medium and moves with your answers: two correct in a row steps the
                  difficulty up, two incorrect steps it down. Each move is shown with the reason the
                  engine recorded.
                </p>
              </div>
              <Link
                href="/dashboard/adaptive"
                className="inline-flex h-11 shrink-0 items-center gap-2 border border-rule-strong bg-white px-5 text-sm font-medium text-ink transition-colors hover:border-ink"
              >
                Start adaptive run <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <dl className="m-0 grid grid-cols-3 gap-px border-t border-rule bg-rule">
              {[
                { k: 'Starting difficulty', v: 'Medium' },
                { k: 'Steps up after', v: '2 correct' },
                { k: 'Steps down after', v: '2 incorrect' },
              ].map((s) => (
                <div key={s.k} className="bg-white px-4 py-3">
                  <dt className="eyebrow">{s.k}</dt>
                  <dd className="mt-1.5 text-sm font-medium text-ink">{s.v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {!loading && (
            <section>
              <div className="border-b border-ink pb-2.5">
                <p className="eyebrow">Uploaded training material</p>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                  Questions generated from these documents enter the trainer review queue; only
                  approved ones reach the assessment above.
                </p>
              </div>

              {materialsError ? (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-ink">Could not load uploaded material</h3>
                    <p className="mt-1 break-words font-mono text-[11px] text-gap-700">
                      {materialsError}
                    </p>
                  </div>
                </div>
              ) : materialList.length === 0 ? (
                <p className="mt-4 max-w-xl border-l-2 border-rule-strong bg-paper-sunken px-4 py-3 text-xs leading-relaxed text-slate-500">
                  No training material has been uploaded yet. A trainer uploads documents from the
                  Document Upload screen.
                </p>
              ) : (
                <ol className="m-0 mt-1 list-none p-0">
                  {materialList.map((m, idx) => (
                    <li
                      key={m.id || idx}
                      className="flex flex-col items-start justify-between gap-2 border-b border-rule py-3.5 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 items-baseline gap-3">
                        <span className="font-mono text-[11px] text-slate-400 tnum">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium text-ink">
                            {m.title || m.filename || 'Untitled document'}
                          </h3>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
                            <span>{m.department || 'Department not recorded'}</span>
                            {typeof m.page_count === 'number' && (
                              <span className="tnum">{m.page_count} pages</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {m.status ? (
                        <span className="shrink-0 border border-rule bg-paper-sunken px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow text-slate-500">
                          {m.status}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
