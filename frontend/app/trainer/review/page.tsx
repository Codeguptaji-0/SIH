"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { AlertTriangle, Check, Loader2, RefreshCw, X } from 'lucide-react';
import { apiJson, ApiError } from '@/app/lib/api';

/**
 * Human-in-the-loop review queue.
 *
 * The demo fallback is gone. This page used to invent a fully written PENDING
 * question whenever the queue came back empty - and because `.json()` ran
 * without checking `res.ok`, a 401 also produced that invented question. A
 * trainer could then "approve" something that did not exist in the database.
 *
 * Generated questions are created with review_status PENDING and the column
 * default is PENDING too, so an empty queue is a legitimate state.
 *
 * Approve/Reject no longer removes the card when the call fails: the previous
 * `catch { setQuestions(prev => prev.filter(...)) }` made a failed review look
 * exactly like a successful one.
 */

interface PendingQuestion {
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

export default function TrainerReviewPage() {
  const [questions, setQuestions] = useState<PendingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<PendingQuestion[]>('/api/trainer/questions?review_status=PENDING');
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the review queue service.');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleAction = async (qid: string, action: 'APPROVE' | 'REJECT') => {
    if (pendingAction) return;
    setPendingAction(qid);
    setActionErrors((prev) => {
      const next = { ...prev };
      delete next[qid];
      return next;
    });

    try {
      await apiJson(`/api/trainer/questions/${encodeURIComponent(qid)}/review`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      // Only drop the card once the backend has actually committed the decision.
      setQuestions((prev) => prev.filter((q) => q.id !== qid));
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [qid]:
          err instanceof ApiError
            ? `${action} failed: ${err.message} (HTTP ${err.status})`
            : `${action} failed before it reached the server. Nothing was saved.`
      }));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar role="TRAINER" />

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-8">
          <header className="flex flex-col justify-between gap-5 border-b-2 border-ink pb-6 md:flex-row md:items-end">
            <div className="min-w-0">
              <p className="eyebrow">Trainer tools / review queue</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
                Human-in-the-loop question review
              </h1>
              <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
                Generated MCQs stay PENDING and are never served to officials until a trainer
                approves them here.
              </p>
            </div>

            <div className="flex shrink-0 items-end gap-5">
              <button
                type="button"
                onClick={loadQueue}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 border border-rule-strong bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </button>

              {!loading && !error && (
                <div>
                  <p className="eyebrow">Pending review</p>
                  <p className="mt-1 font-display text-4xl font-semibold text-ink tnum">
                    {questions.length}
                  </p>
                </div>
              )}
            </div>
          </header>

          <div className="mt-8 space-y-8">

          {loading && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-3 border border-rule bg-white px-5 py-10 text-xs text-slate-500"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading review queue…
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-ink">Review queue could not be loaded</h2>
                <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{error}</p>
                <p className="mt-1.5 text-xs text-gap-700">
                  No questions are listed, because none were received from the server.
                </p>
              </div>
            </div>
          )}

          {!loading && !error && questions.length === 0 && (
            <div className="border border-rule bg-white px-5 py-6">
              <h2 className="text-sm font-medium text-ink">Nothing is waiting for review</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                There are no PENDING questions. On a fresh system this is expected: generate MCQs
                from an uploaded learning material and they will appear here for approval.
              </p>
            </div>
          )}

          {!loading && !error && questions.length > 0 && (
            <section>
              <div className="border-b border-ink pb-2.5">
                <p className="eyebrow">Awaiting decision</p>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                  A decision is recorded only once the backend confirms it. If a call fails, the
                  question stays in this queue with the error attached to it.
                </p>
              </div>
              <ol className="m-0 mt-1 list-none p-0">
              {questions.map((q) => {
                const options = Array.isArray(q.options) ? q.options : [];
                const busy = pendingAction === q.id;
                return (
                  <li key={q.id} className="border-b border-rule py-5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                      <span className="eyebrow">{q.competency_name}</span>
                      <div className="flex items-center gap-2.5">
                        {q.difficulty && (
                          <span className="font-mono text-[10px] uppercase tracking-eyebrow text-slate-500">
                            Difficulty: {q.difficulty}
                          </span>
                        )}
                        <span className="border border-watch-200 bg-watch-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow text-watch-700">
                          {q.review_status}
                        </span>
                      </div>
                    </div>

                    <h2 className="mt-2 text-sm font-medium text-ink">{q.question_text}</h2>

                    <ul className="m-0 mt-3 grid list-none grid-cols-1 gap-px border border-rule bg-rule p-0 sm:grid-cols-2">
                      {options.map((opt, idx) => (
                        <li
                          key={idx}
                          className={`px-3 py-2.5 text-xs ${
                            idx === q.correct_option
                              ? 'bg-strong-50 font-medium text-strong-800'
                              : 'bg-white text-slate-600'
                          }`}
                        >
                          <span className="font-mono text-[11px] text-slate-400">
                            {String.fromCharCode(65 + idx)}.
                          </span>{' '}
                          {opt}
                          {idx === q.correct_option && ' (Marked correct)'}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 border-l-2 border-rule-strong bg-paper-sunken px-4 py-3">
                      <p className="eyebrow">Explanation</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {q.explanation || (
                          <span className="text-slate-400">No explanation was recorded.</span>
                        )}
                      </p>
                    </div>

                    {q.source_reference && (
                      <p className="mt-2.5 break-words font-mono text-[11px] text-slate-400">
                        Source: {q.source_reference}
                      </p>
                    )}

                    {actionErrors[q.id] && (
                      <div
                        role="alert"
                        className="mt-3 flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3"
                      >
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-gap-600"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="break-words font-mono text-[11px] text-gap-700">
                            {actionErrors[q.id]}
                          </p>
                          <p className="mt-1 text-[11px] text-gap-700">
                            The question was left in the queue.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => handleAction(q.id, 'REJECT')}
                        disabled={busy}
                        className="inline-flex h-9 items-center gap-1.5 border border-gap-600 bg-white px-4 text-xs font-medium text-gap-700 transition-colors hover:bg-gap-50 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" /> Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(q.id, 'APPROVE')}
                        disabled={busy}
                        className="inline-flex h-9 items-center gap-1.5 border border-navy-600 bg-navy-600 px-4 text-xs font-medium text-paper transition-colors hover:bg-navy-700 disabled:opacity-50"
                      >
                        {busy ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Saving
                          </>
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Approve and publish
                          </>
                        )}
                      </button>
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


