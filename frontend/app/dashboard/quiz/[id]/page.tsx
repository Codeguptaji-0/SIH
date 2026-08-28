"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { WowTransitionModal } from '@/components/WowTransitionModal';
import { ArrowRight, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
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
  // How these particular questions were chosen, in the backend's own words, and how
  // many competencies they cover. A gap report is only as defensible as its sampling,
  // so the sampling is shown rather than left for the officer to assume.
  selection_method?: string | null;
  competencies_covered?: number | null;
}

/**
 * The submit response. Every field here is returned by
 * POST /api/quizzes/{quiz_id}/submit - nothing on this screen is computed in the
 * browser, because a score the client invents is a score nobody can audit.
 *
 * answer_review carries the correct option and the stored explanation for each
 * answered question. The backend always held these and used to discard them, so an
 * officer was given a percentage and never told what was actually wrong.
 */
interface AnswerReviewItem {
  question_id: string;
  question_text: string;
  competency_name: string;
  difficulty: string;
  options: string[];
  selected_option: number | null;
  selected_text: string | null;
  correct_option: number;
  correct_text: string | null;
  is_correct: boolean;
  explanation: string;
}

interface CompetencyResultItem {
  competency_id: string;
  competency_name: string;
  domain: string;
  score: number;
  status: string;
  benchmark: string;
  target_score: number | null;
  gap_points: number;
  priority: number;
  evidence: string;
  // How much the band actually rests on. One answer forces 0% or 100%, so a row
  // measured that thinly is labelled instead of being shown as a finding.
  questions_answered?: number;
  questions_correct?: number;
  low_evidence?: boolean;
}

interface SubmitResponse {
  attempt_id: string;
  overall_score: number;
  raw_score: number;
  scoring_method: string;
  banding_method: string;
  job_role: string | null;
  role_targets_applied: number;
  total_questions: number;
  correct_answers: number;
  results: CompetencyResultItem[];
  answer_review: AnswerReviewItem[];
  competencies_measured?: number;
  low_evidence_competencies?: number;
  evidence_rule?: string | null;
}

export default function AdaptiveQuizPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [approvedPoolSize, setApprovedPoolSize] = useState<number | null>(null);
  const [selectionMethod, setSelectionMethod] = useState<string | null>(null);
  const [competenciesCovered, setCompetenciesCovered] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWowModal, setShowWowModal] = useState(false);
  const [review, setReview] = useState<SubmitResponse | null>(null);

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
      setSelectionMethod(typeof data?.selection_method === 'string' ? data.selection_method : null);
      setCompetenciesCovered(
        typeof data?.competencies_covered === 'number' ? data.competencies_covered : null
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
      const data = await apiJson<SubmitResponse>(`/api/quizzes/${encodeURIComponent(quizId)}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: payloadAnswers })
      });
      setReview(data);
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

  // The review screen only appears because the server sent one. If the response
  // somehow carried no per-question review, go straight to the analysis page rather
  // than rendering an empty "what you got wrong" panel.
  const handleWowModalComplete = () => {
    setShowWowModal(false);
    if (!review || review.answer_review.length === 0) {
      router.push('/dashboard/results');
    }
  };

  const answeredCount = Object.keys(userAnswers).length;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 md:px-8">
          <header className="border-b-2 border-ink pb-6">
            <p className="eyebrow">Assessment session</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
              Competency assessment
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
              Every question here has been approved by a trainer. Your score, the bands and the
              per-question review are all computed on the server.
            </p>
          </header>

          <div className="mt-8 space-y-8">

          {loading && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-3 border border-rule bg-white px-5 py-10 text-xs text-slate-500"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading your assessment session…
            </div>
          )}

          {!loading && loadError && (
            <div role="alert" className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-ink">Could not load the assessment</h2>
                <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{loadError}</p>
                <button
                  type="button"
                  onClick={loadQuiz}
                  className="mt-3 inline-flex h-9 items-center border border-rule-strong bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-ink"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {!loading && !loadError && questions.length === 0 && (
            <div className="border border-rule bg-white px-5 py-6">
              <h2 className="text-sm font-medium text-ink">No assessment is available yet</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                {emptyMessage ??
                  'The question bank has no trainer-approved questions, so there is nothing to assess yet.'}
              </p>
              {approvedPoolSize !== null && (
                <p className="mt-2 font-mono text-[11px] text-slate-400 tnum">
                  Trainer-approved questions available: {approvedPoolSize}
                </p>
              )}
              <button
                type="button"
                onClick={loadQuiz}
                className="mt-4 inline-flex h-9 items-center border border-rule-strong bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-ink"
              >
                Check again
              </button>
            </div>
          )}

          {!loading && !loadError && questions.length > 0 && !review && (
            <QuizRunner
              questions={questions}
              currentIndex={currentIndex}
              userAnswers={userAnswers}
              answeredCount={answeredCount}
              isSubmitting={isSubmitting}
              submitError={submitError}
              selectionMethod={selectionMethod}
              competenciesCovered={competenciesCovered}
              approvedPoolSize={approvedPoolSize}
              onSelectOption={handleSelectOption}
              onPrev={handlePrev}
              onNext={handleNext}
              onSubmit={handleSubmitQuiz}
            />
          )}

          {review && !showWowModal && (
            <SubmissionReview
              data={review}
              onContinue={() => router.push('/dashboard/results')}
            />
          )}
          </div>
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
  selectionMethod: string | null;
  competenciesCovered: number | null;
  approvedPoolSize: number | null;
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
  selectionMethod,
  competenciesCovered,
  approvedPoolSize,
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
      ? 'border-gap-200 bg-gap-50 text-gap-700'
      : currentQ.difficulty === 'medium'
      ? 'border-watch-200 bg-watch-50 text-watch-700'
      : 'border-strong-200 bg-strong-50 text-strong-700';

  return (
    <>
      {/* Where you are in the run, plus the competency this question measures. */}
      <div className="border border-rule bg-white px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">
              Question {currentIndex + 1} of {questions.length}
            </p>
            <p className="mt-1.5 text-sm text-ink">
              Competency: <span className="font-medium">{currentQ.competency_name}</span>
            </p>
          </div>
          {currentQ.difficulty && (
            <span
              className={`shrink-0 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-eyebrow ${difficultyClass}`}
            >
              {currentQ.difficulty}
            </span>
          )}
        </div>

        <div
          className="mt-3.5 h-[6px] w-full bg-paper-sunken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={currentIndex + 1}
          aria-label="Assessment progress"
        >
          <div
            className="h-full bg-navy-600"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/*
          Say how these questions were chosen. Ten questions spread thinly over ten
          competencies can only ever score each of them 0% or 100%, so the backend
          concentrates them and reports that choice in selection_method. Showing it
          here means the officer can see what the coming gap report is based on.
        */}
        {selectionMethod && (
          <p className="mt-3.5 border-t border-rule pt-3 text-[11px] leading-relaxed text-slate-500">
            {selectionMethod}
            {competenciesCovered !== null && (
              <span className="font-mono text-slate-400">
                {' '}
                ({questions.length} questions across {competenciesCovered}{' '}
                {competenciesCovered === 1 ? 'competency' : 'competencies'}
                {approvedPoolSize !== null && <> from a pool of {approvedPoolSize} approved</>})
              </span>
            )}
          </p>
        )}
      </div>

      {/* The question itself. */}
      <div className="border border-ink bg-white px-5 py-5">
        <h2 className="font-display text-lg font-semibold leading-snug tracking-tight text-ink">
          {currentQ.question_text}
        </h2>

        <ol className="m-0 mt-4 list-none border-t border-rule p-0">
          {options.map((opt, idx) => {
            const isSelected = selectedOpt === idx;
            return (
              <li key={idx} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => onSelectOption(idx)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-baseline justify-between gap-3 border-l-2 px-3 py-3.5 text-left text-xs transition-colors ${
                    isSelected
                      ? 'border-l-navy-600 bg-paper-sunken text-ink'
                      : 'border-l-transparent text-slate-600 hover:border-l-rule-strong'
                  }`}
                >
                  <span className="flex items-baseline gap-3">
                    <span
                      className={`font-mono text-[11px] ${
                        isSelected ? 'text-navy-700' : 'text-slate-400'
                      }`}
                      aria-hidden="true"
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="leading-relaxed">{opt}</span>
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-navy-600" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        {currentQ.source_reference && (
          <p className="mt-3.5 font-mono text-[11px] text-slate-400">
            Source reference: {currentQ.source_reference}
          </p>
        )}
      </div>

      {submitError && (
        <div role="alert" className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-ink">Submission rejected</h3>
            <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{submitError}</p>
            <p className="mt-1.5 text-xs text-gap-700">
              Nothing was recorded. Your answers are still selected, so you can retry.
            </p>
          </div>
        </div>
      )}

      {/* Navigation. */}
      <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="inline-flex h-9 items-center gap-1.5 border border-rule-strong bg-white px-3 text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-40"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || answeredCount === 0}
            className="inline-flex h-11 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Submitting
              </>
            ) : (
              <>
                Submit for scoring <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-11 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
          >
            Next question <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}

const STATUS_STYLES: Record<string, string> = {
  strong: 'border-strong-200 bg-strong-50 text-strong-700',
  needs_improvement: 'border-watch-200 bg-watch-50 text-watch-700',
  critical_gap: 'border-gap-200 bg-gap-50 text-gap-700'
};

/**
 * Post-submission review.
 *
 * Everything rendered here comes from the submit response: the score, the banding,
 * the role target each competency was judged against, and the stored explanation for
 * each question. Nothing is recomputed in the browser.
 */
function SubmissionReview({
  data,
  onContinue
}: {
  data: SubmitResponse;
  onContinue: () => void;
}) {
  const results = Array.isArray(data.results) ? data.results : [];
  const answers = Array.isArray(data.answer_review) ? data.answer_review : [];
  const ordered = [...results].sort(
    (a, b) => (a.priority === 0 ? 999 : a.priority) - (b.priority === 0 ? 999 : b.priority)
  );

  return (
    <div className="space-y-8">
      <section className="border-2 border-ink bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
          <div className="min-w-0">
            <p className="eyebrow">Assessment scored</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink tnum">
              {data.overall_score}%
            </h2>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
              {data.correct_answers} of {data.total_questions} answered correctly (raw{' '}
              {data.raw_score}%). Weighted by difficulty: {data.scoring_method}.
            </p>
          </div>
          <p className="shrink-0 font-mono text-[11px] text-slate-400">
            attempt {data.attempt_id.slice(0, 8)}
          </p>
        </div>

        <p className="border-t border-rule px-5 py-4 text-xs leading-relaxed text-slate-600">
          {data.job_role && data.role_targets_applied > 0 ? (
            <>
              Banded against the proficiency targets for{' '}
              <span className="font-medium text-ink">{data.job_role}</span> on{' '}
              {data.role_targets_applied} of {results.length} competencies. A shortfall here means a
              shortfall against what this role requires, not against a single pass mark.
            </>
          ) : (
            <>
              No proficiency targets are defined for this job role yet, so standard thresholds were
              applied: {data.banding_method}.
            </>
          )}
        </p>
      </section>

      {ordered.length > 0 && (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink pb-2.5">
            <p className="eyebrow">Competency breakdown</p>
            {/*
              How thin the thinnest rows are, in the backend's own words. A single
              answer forces 0% or 100%, which is how a one-question competency ended
              up reported as a 65-point critical gap. Said out loud, it cannot pass
              for a finding.
            */}
            {typeof data.low_evidence_competencies === 'number' &&
              data.low_evidence_competencies > 0 && (
                <span className="border border-watch-200 bg-watch-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow text-watch-700">
                  {data.low_evidence_competencies} of {ordered.length} thinly measured
                </span>
              )}
          </div>
          <ol className="m-0 mt-1 list-none p-0">
            {ordered.map((r) => (
              <li key={r.competency_id} className="border-b border-rule py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-sm font-medium text-ink">{r.competency_name}</h3>
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    {typeof r.questions_answered === 'number' && (
                      <span className="font-mono text-[10px] text-slate-400 tnum">
                        {r.questions_correct ?? 0}/{r.questions_answered}{' '}
                        {r.questions_answered === 1 ? 'answer' : 'answers'}
                      </span>
                    )}
                    {r.low_evidence && (
                      <span className="border border-watch-200 bg-watch-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow text-watch-700">
                        low evidence
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-ink tnum">
                      {r.score}%
                      {r.target_score !== null && (
                        <span className="text-slate-400"> / target {r.target_score}%</span>
                      )}
                    </span>
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${
                        STATUS_STYLES[r.status] ?? 'border-rule bg-paper-sunken text-slate-500'
                      }`}
                    >
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-600">
                  {r.evidence}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-eyebrow text-slate-400">
                  {r.benchmark === 'role_target'
                    ? 'benchmark: role target'
                    : 'benchmark: standard threshold'}
                </p>
              </li>
            ))}
          </ol>
          {data.evidence_rule && (
            <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-slate-400">
              {data.evidence_rule}
            </p>
          )}
        </section>
      )}
      {answers.length > 0 && (
        <section>
          <div className="border-b border-ink pb-2.5">
            <p className="eyebrow">Question review</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              {answers.filter((a) => !a.is_correct).length} of {answers.length} to revisit. The
              correct option and the stored explanation come from the question record.
            </p>
          </div>
          <ol className="m-0 mt-1 list-none p-0">
            {answers.map((a, i) => (
              <li
                key={a.question_id}
                className={`border-b border-rule border-l-2 py-3.5 pl-4 ${
                  a.is_correct ? 'border-l-strong-600' : 'border-l-gap-600'
                }`}
              >
                <div className="flex items-baseline gap-2.5">
                  {a.is_correct ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-strong-600" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-gap-600" aria-hidden="true" />
                  )}
                  <p className="eyebrow">
                    Q{i + 1} &middot; {a.competency_name} &middot; {a.difficulty}
                  </p>
                </div>
                <h3 className="mt-1.5 text-sm font-medium leading-snug text-ink">
                  {a.question_text}
                </h3>

                <dl className="m-0 mt-2 text-[11px]">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-slate-500">Your answer:</dt>
                    <dd className={`m-0 ${a.is_correct ? 'text-strong-700' : 'text-gap-700'}`}>
                      {a.selected_text ?? 'not answered'}
                    </dd>
                  </div>
                  {!a.is_correct && a.correct_text && (
                    <div className="mt-0.5 flex flex-wrap gap-x-2">
                      <dt className="text-slate-500">Correct answer:</dt>
                      <dd className="m-0 text-strong-700">{a.correct_text}</dd>
                    </div>
                  )}
                </dl>

                {a.explanation && (
                  <p className="mt-2 max-w-2xl border-l-2 border-rule-strong bg-paper-sunken px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                    <span className="font-medium text-ink">Why: </span>
                    {a.explanation}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex justify-end border-t border-rule pt-4">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex h-11 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
        >
          View full competency analysis <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
