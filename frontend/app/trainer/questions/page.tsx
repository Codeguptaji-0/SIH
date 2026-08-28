"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { BookOpen, AlertTriangle, Loader2 } from 'lucide-react';
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

const STATUS_CLASSES: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  PENDING: 'bg-amber-100 text-amber-800 border border-amber-200',
  REJECTED: 'bg-rose-100 text-rose-800 border border-rose-200'
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="TRAINER" />

      <div className="flex flex-1">
        <Sidebar role="TRAINER" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6 w-full">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Question Bank Repository</h1>
              <p className="text-xs text-slate-500 mt-1">
                Objective MCQs mapped to MoSPI statistical domains. Only APPROVED questions are
                served to officials.
              </p>
            </div>
            {!loading && !error && questions.length > 0 && (
              <div className="text-xs font-mono font-bold text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                {questions.length} total / {approvedCount} approved / {pendingCount} pending
              </div>
            )}
          </div>

          {loading && (
            <div
              role="status"
              aria-live="polite"
              className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-sm text-slate-500"
            >
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" aria-hidden="true" />
              Loading question bank...
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="bg-white p-8 rounded-2xl border border-rose-200 shadow-sm text-center space-y-3"
            >
              <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">Question bank could not be loaded</h2>
              <p className="text-xs text-rose-700 font-mono break-words">{error}</p>
              <button
                type="button"
                onClick={loadQuestions}
                className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && questions.length === 0 && (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <BookOpen className="w-10 h-10 text-slate-400 mx-auto" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">The question bank is empty</h2>
              <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
                No questions have been generated yet. Upload a learning material and generate MCQs
                from it; they will arrive here with review_status PENDING until a trainer approves
                them.
              </p>
              <button
                type="button"
                onClick={loadQuestions}
                className="mt-2 px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Refresh
              </button>
            </div>
          )}

          {!loading && !error && questions.length > 0 && (
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const options = Array.isArray(q.options) ? q.options : [];
                const statusClass =
                  STATUS_CLASSES[q.review_status] ?? 'bg-slate-100 text-slate-700 border border-slate-200';
                return (
                  <div
                    key={q.id || idx}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {q.competency_name}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase font-mono px-2.5 py-0.5 rounded-full ${statusClass}`}
                      >
                        Status: {q.review_status}
                      </span>
                    </div>

                    <h2 className="text-xs font-bold text-slate-900">
                      {idx + 1}. {q.question_text}
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`p-2.5 rounded-xl border font-medium ${
                            oIdx === q.correct_option
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          {String.fromCharCode(65 + oIdx)}. {opt}
                          {oIdx === q.correct_option && ' (Correct)'}
                        </div>
                      ))}
                    </div>

                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <strong>Explanation:</strong>{' '}
                      {q.explanation || <span className="text-slate-400">No explanation recorded.</span>}
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

