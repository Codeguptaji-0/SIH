"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { apiJson, ApiError } from '@/app/lib/api';

/**
 * Question bank repository.
 *
 * This page previously called `.json()` without checking `res.ok`, so a 401 or
 * 500 error body was written straight into the `questions` array, and it
 * rendered every question with an emerald "Status: ..." badge regardless of the
 * real review_status - a PENDING or REJECTED question looked approved.
 *
 * Generated questions are now created with review_status PENDING and the column
 * default is PENDING as well, so an empty approved list is the correct state for
 * a fresh system and is shown as such.
 */

interface TrainerQuestion {
  id: string;
  competency_id: string;
  competency_name: string;
  question_text: string;
  options: string[];
  correct_option: number;
  explanation: string;
  difficulty: string;
  review_status: string;
  source_reference: string;
}

/** Review status chips, in the three publication inks. */
const STATUS_CLASSES: Record<string, string> = {
  APPROVED: 'border-strong-200 bg-strong-50 text-strong-700',
  PENDING: 'border-watch-200 bg-watch-50 text-watch-700',
  REJECTED: 'border-gap-200 bg-gap-50 text-gap-700'
};

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<TrainerQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<TrainerQuestion[]>('/api/trainer/questions');
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the question bank service.');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Counts are derived from the loaded rows, not asserted.
  const approvedCount = questions.filter((q) => q.review_status === 'APPROVED').length;
  const pendingCount = questions.filter((q) => q.review_status === 'PENDING').length;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar role="TRAINER" />

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-8">
          <header className="flex flex-col justify-between gap-5 border-b-2 border-ink pb-6 md:flex-row md:items-end">
            <div className="min-w-0">
              <p className="eyebrow">Trainer tools / question bank</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
                Question bank repository
              </h1>
              <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
                Objective MCQs mapped to MoSPI statistical domains. Only APPROVED questions are
                served to officials.
              </p>
            </div>
            <button
              type="button"
              onClick={loadQuestions}
              disabled={loading}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 border border-rule-strong bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
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
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading question bank…
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-ink">Question bank could not be loaded</h2>
                <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{error}</p>
                <p className="mt-1.5 text-xs text-gap-700">
                  No questions are listed, because none were received from the server.
                </p>
              </div>
            </div>
          )}

          {!loading && !error && questions.length === 0 && (
            <div className="border border-rule bg-white px-5 py-6">
              <h2 className="text-sm font-medium text-ink">The question bank is empty</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                No questions have been generated yet. Upload a learning material and generate MCQs
                from it; they will arrive here with review_status PENDING until a trainer approves
                them.
              </p>
            </div>
          )}

          {!loading && !error && questions.length > 0 && (
            <dl className="m-0 grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-3">
              <div className="bg-white px-5 py-4">
                <dt className="eyebrow">Total questions</dt>
                <dd className="m-0 mt-1.5 font-display text-3xl font-semibold text-ink tnum">
                  {questions.length}
                </dd>
              </div>
              <div className="bg-white px-5 py-4">
                <dt className="eyebrow">Approved</dt>
                <dd className="m-0 mt-1.5 font-display text-3xl font-semibold text-strong-700 tnum">
                  {approvedCount}
                </dd>
              </div>
              <div className="bg-white px-5 py-4">
                <dt className="eyebrow">Pending review</dt>
                <dd className="m-0 mt-1.5 font-display text-3xl font-semibold text-watch-700 tnum">
                  {pendingCount}
                </dd>
              </div>
            </dl>
          )}

          {!loading && !error && questions.length > 0 && (
            <section>
              <div className="border-b border-ink pb-2.5">
                <p className="eyebrow">Question records</p>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                  The shaded option is the one recorded as correct. Review status is shown exactly as
                  stored, so a PENDING or REJECTED question is not being served to officials.
                </p>
              </div>
              <ol className="m-0 mt-1 list-none p-0">
              {questions.map((q, idx) => {
                const options = Array.isArray(q.options) ? q.options : [];
                const statusClass =
                  STATUS_CLASSES[q.review_status] ?? 'border-rule bg-paper-sunken text-slate-500';
                return (
                  <li key={q.id || idx} className="border-b border-rule py-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[11px] text-slate-400 tnum">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span className="eyebrow">{q.competency_name}</span>
                          <span
                            className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${statusClass}`}
                          >
                            {q.review_status}
                          </span>
                        </div>

                        <h2 className="mt-1.5 text-sm font-medium text-ink">{q.question_text}</h2>

                        <ul className="m-0 mt-2.5 grid list-none grid-cols-1 gap-px border border-rule bg-rule p-0 sm:grid-cols-2">
                          {options.map((opt, oIdx) => (
                            <li
                              key={oIdx}
                              className={`px-3 py-2 text-xs ${
                                oIdx === q.correct_option
                                  ? 'bg-strong-50 font-medium text-strong-800'
                                  : 'bg-white text-slate-600'
                              }`}
                            >
                              <span className="font-mono text-[11px] text-slate-400">
                                {String.fromCharCode(65 + oIdx)}.
                              </span>{' '}
                              {opt}
                              {oIdx === q.correct_option && ' (Correct)'}
                            </li>
                          ))}
                        </ul>

                        <div className="mt-2.5 border-l-2 border-rule-strong bg-paper-sunken px-3.5 py-2.5">
                          <p className="eyebrow">Explanation</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                            {q.explanation || (
                              <span className="text-slate-400">No explanation recorded.</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
              </ol>
            </section>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}

