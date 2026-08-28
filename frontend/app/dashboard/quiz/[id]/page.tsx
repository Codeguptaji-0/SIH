"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { WowTransitionModal } from '@/components/WowTransitionModal';
import { ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { apiJson, ApiError } from '@/app/lib/api';

/**
 * Adaptive assessment runner.
 *
 * There is deliberately no hardcoded question bank in this file. It previously
 * carried five fully written MCQs and rendered them whenever
 * GET /api/quizzes/active returned nothing - including when the call actually
 * failed, because the response was passed to `.json()` without checking
 * `res.ok`. An officer could therefore sit a five-question "assessment" that no
 * trainer had ever approved, and the resulting score described nothing.
 *
 * The backend now serves only trainer-APPROVED questions and reports
 * `approved_pool_size` plus an explanatory `message` when the pool is empty, so
 * an empty assessment is shown as an empty assessment.
 */

interface QuizQuestion {
  id: string;
  competency_id: string;
  competency_name: string;
  domain: string;
  question_text: string;
  options: string[];
  difficulty: string;
  source_reference: string;
}

interface ActiveQuizResponse {
  quiz_id: string;
  total_questions: number;
  questions: QuizQuestion[];
  approved_pool_size: number;
  message: string | null;
}

export default function AdaptiveQuizPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [approvedPoolSize, setApprovedPoolSize] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWowModal, setShowWowModal] = useState(false);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiJson<ActiveQuizResponse>('/api/quizzes/active');
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
      setQuizId(data?.quiz_id ?? null);
      setEmptyMessage(data?.message ?? null);
      setApprovedPoolSize(
        typeof data?.approved_pool_size === 'number' ? data.approved_pool_size : null
      );
      setCurrentIndex(0);
      setUserAnswers({});
    } catch (err) {
      // Show the backend's own reason (401 session expired, 500, unreachable API)
      // rather than silently falling back to invented questions.
      setLoadError(err instanceof ApiError ? err.message : 'Could not reach the assessment service.');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const handleSelectOption = (optionIdx: number) => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;
    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: optionIdx }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  /**
   * Submit answers.
   *
   * POST /api/quizzes/{quiz_id}/submit returns 400 when a question_id is unknown
   * or not trainer-approved. The old version awaited the call inside a try/catch
   * that swallowed everything and then opened the success animation regardless,
   * so a rejected submission still looked like a completed assessment.
   */
  const handleSubmitQuiz = async () => {
    if (!quizId) {
      setSubmitError('No active assessment session to submit to.');
      return;
    }

    const payloadAnswers = Object.entries(userAnswers).map(([qid, opt]) => ({
      question_id: qid,
      selected_option: opt
    }));

    if (payloadAnswers.length === 0) {
      setSubmitError('Answer at least one question before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await apiJson(`/api/quizzes/${encodeURIComponent(quizId)}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: payloadAnswers })
      });
      setShowWowModal(true);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : 'Submission failed before it reached the server. Your answers were not recorded.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWowModalComplete = () => {
    router.push('/dashboard/results');
  };

  const answeredCount = Object.keys(userAnswers).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-4xl mx-auto space-y-6 w-full">
          {loading && (
            <div
              role="status"
              aria-live="polite"
              className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-sm text-slate-500"
            >
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" aria-hidden="true" />
              Loading your assessment session...
            </div>
          )}

          {!loading && loadError && (
            <div
              role="alert"
              className="bg-white p-8 rounded-3xl border border-rose-200 shadow-sm text-center space-y-3"
            >
              <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">Could not load the assessment</h2>
              <p className="text-xs text-rose-700 font-mono break-words">{loadError}</p>
              <button
                type="button"
                onClick={loadQuiz}
                className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !loadError && questions.length === 0 && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
              <Inbox className="w-10 h-10 text-slate-400 mx-auto" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">No assessment is available yet</h2>
              <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
                {emptyMessage ??
                  'The question bank has no trainer-approved questions, so there is nothing to assess yet.'}
              </p>
              {approvedPoolSize !== null && (
                <p className="text-[11px] text-slate-400 font-mono">
                  Trainer-approved questions available: {approvedPoolSize}
                </p>
              )}
              <button
                type="button"
                onClick={loadQuiz}
                className="mt-2 px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Check again
              </button>
            </div>
          )}

          {!loading && !loadError && questions.length > 0 && (
            <QuizRunner
              questions={questions}
              currentIndex={currentIndex}
              userAnswers={userAnswers}
              answeredCount={answeredCount}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onSelectOption={handleSelectOption}
              onPrev={handlePrev}
              onNext={handleNext}
              onSubmit={handleSubmitQuiz}
            />
          )}
        </main>
      </div>

      <WowTransitionModal isOpen={showWowModal} onComplete={handleWowModalComplete} />
    </div>
  );
}

interface QuizRunnerProps {
  questions: QuizQuestion[];
  currentIndex: number;
  userAnswers: Record<string, number>;
  answeredCount: number;
  isSubmitting: boolean;
  submitError: string | null;
  onSelectOption: (idx: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

function QuizRunner({
  questions,
  currentIndex,
  userAnswers,
  answeredCount,
  isSubmitting,
  submitError,
  onSelectOption,
  onPrev,
  onNext,
  onSubmit
}: QuizRunnerProps) {
  const currentQ = questions[currentIndex];
  const selectedOpt = userAnswers[currentQ.id];
  const options = Array.isArray(currentQ.options) ? currentQ.options : [];
  const isLast = currentIndex === questions.length - 1;

  const difficultyClass =
    currentQ.difficulty === 'hard'
      ? 'bg-rose-100 text-rose-700 border border-rose-200'
      : currentQ.difficulty === 'medium'
      ? 'bg-amber-100 text-amber-800 border border-amber-200'
      : 'bg-emerald-100 text-emerald-800 border border-emerald-200';

  return (
    <>
      {/* Progress Indicator Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xs font-mono text-blue-600 font-bold">
            QUESTION {currentIndex + 1} OF {questions.length}
          </div>
          <div className="text-sm font-bold text-slate-800 mt-0.5">
            Competency: <span className="text-blue-700">{currentQ.competency_name}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {currentQ.difficulty && (
            <span
              className={`text-[11px] font-bold px-3 py-1 rounded-full font-mono uppercase ${difficultyClass}`}
            >
              Difficulty: {currentQ.difficulty}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className="w-full bg-slate-200 h-2 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={currentIndex + 1}
        aria-label="Assessment progress"
      >
        <div
          className="bg-blue-600 h-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        ></div>
      </div>

      {/* Question Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
          {currentQ.question_text}
        </h2>

        <div className="space-y-3">
          {options.map((opt, idx) => {
            const isSelected = selectedOpt === idx;
            return (
              <button
                type="button"
                key={idx}
                onClick={() => onSelectOption(idx)}
                aria-pressed={isSelected}
                className={`w-full text-left p-4 rounded-2xl border text-xs font-medium transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                    aria-hidden="true"
                  >
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span>{opt}</span>
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {currentQ.source_reference && (
          <div className="text-[11px] text-slate-400 font-mono border-t border-slate-100 pt-3">
            Source Reference: {currentQ.source_reference}
          </div>
        )}
      </div>

      {submitError && (
        <div
          role="alert"
          className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs space-y-1"
        >
          <div className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Submission rejected
          </div>
          <p className="font-mono break-words">{submitError}</p>
          <p className="text-[11px] text-rose-700">
            Nothing was recorded. Your answers are still selected, so you can retry.
          </p>
        </div>
      )}

      {/* Navigation Controls */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Previous
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || answeredCount === 0}
            className="px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Analyze My Competency'}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2"
          >
            Next Question <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}
