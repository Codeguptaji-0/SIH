"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { CheckCircle2, XCircle, AlertTriangle, FileCheck, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="TRAINER" />

      <div className="flex flex-1">
        <Sidebar role="TRAINER" />

        <main className="flex-1 p-6 sm:p-8 max-w-5xl mx-auto space-y-6 w-full">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Human-in-the-Loop Question Review
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Generated MCQs stay PENDING and are never served to officials until a trainer
                approves them here
              </p>
            </div>
            {!loading && !error && (
              <div className="bg-amber-100 border border-amber-300 text-amber-800 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
                <FileCheck className="w-4 h-4" aria-hidden="true" /> {questions.length} Pending Review
              </div>
            )}
          </div>

          {loading && (
            <div
              role="status"
              aria-live="polite"
              className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-sm text-slate-500"
            >
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" aria-hidden="true" />
              Loading review queue...
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="bg-white p-8 rounded-3xl border border-rose-200 shadow-sm text-center space-y-3"
            >
              <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">Review queue could not be loaded</h2>
              <p className="text-xs text-rose-700 font-mono break-words">{error}</p>
              <button
                type="button"
                onClick={loadQueue}
                className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && questions.length === 0 && (
            <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-slate-400 mx-auto" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">Nothing is waiting for review</h2>
              <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
                There are no PENDING questions. On a fresh system this is expected: generate MCQs
                from an uploaded learning material and they will appear here for approval.
              </p>
              <button
                type="button"
                onClick={loadQueue}
                className="mt-2 px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Refresh
              </button>
            </div>
          )}

          {!loading && !error && questions.length > 0 && (
            <div className="space-y-4">
              {questions.map((q) => {
                const options = Array.isArray(q.options) ? q.options : [];
                const busy = pendingAction === q.id;
                return (
                  <div
                    key={q.id}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {q.competency_name}
                      </span>
                      <div className="flex items-center gap-2">
                        {q.difficulty && (
                          <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                            Difficulty: {q.difficulty}
                          </span>
                        )}
                        <span className="text-[10px] font-mono uppercase text-amber-700 font-bold">
                          {q.review_status}
                        </span>
                      </div>
                    </div>

                    <h2 className="text-sm font-bold text-slate-900">{q.question_text}</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {options.map((opt, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border ${
                            idx === q.correct_option
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}. {opt}
                          {idx === q.correct_option && ' (Marked correct)'}
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <strong>Explanation:</strong>{' '}
                      {q.explanation || (
                        <span className="text-slate-400">No explanation was recorded.</span>
                      )}
                    </div>

                    {q.source_reference && (
                      <div className="text-[11px] text-slate-400 font-mono">
                        Source: {q.source_reference}
                      </div>
                    )}

                    {actionErrors[q.id] && (
                      <p
                        role="alert"
                        className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 font-mono break-words"
                      >
                        {actionErrors[q.id]}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleAction(q.id, 'REJECT')}
                        disabled={busy}
                        className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" aria-hidden="true" /> Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(q.id, 'APPROVE')}
                        disabled={busy}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        {busy ? 'Saving...' : 'Approve & Publish'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}


