"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { WowTransitionModal } from '@/components/WowTransitionModal';
import { ArrowRight, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Inbox, Loader2, Target, BookOpen } from 'lucide-react';
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

      {/*
        Say how these questions were chosen. Ten questions spread thinly over ten
        competencies can only ever score each of them 0% or 100%, so the backend
        concentrates them and reports that choice in selection_method. Showing it
        here means the officer can see what the coming gap report is based on.
      */}
      {selectionMethod && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3 flex items-start gap-2">
          <Target className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {selectionMethod}
            {competenciesCovered !== null && (
              <span className="font-mono text-slate-500">
                {' '}
                ({questions.length} questions across {competenciesCovered}{' '}
                {competenciesCovered === 1 ? 'competency' : 'competencies'}
                {approvedPoolSize !== null && <> from a pool of {approvedPoolSize} approved</>})
              </span>
            )}
          </p>
        </div>
      )}

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

const STATUS_STYLES: Record<string, string> = {
  strong: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  needs_improvement: 'bg-amber-100 text-amber-800 border-amber-200',
  critical_gap: 'bg-rose-100 text-rose-800 border-rose-200'
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
    <div className="space-y-6">
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-mono text-blue-600 font-bold">ASSESSMENT SCORED</div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              {data.overall_score}% competency score
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {data.correct_answers} of {data.total_questions} answered correctly (raw{' '}
              {data.raw_score}%). Weighted by difficulty: {data.scoring_method}.
            </p>
          </div>
          <div className="text-[11px] font-mono text-slate-400 text-right">
            attempt {data.attempt_id.slice(0, 8)}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 flex items-start gap-2 text-xs text-slate-600">
          <Target className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            {data.job_role && data.role_targets_applied > 0 ? (
              <>
                Banded against the proficiency targets for{' '}
                <span className="font-bold text-slate-800">{data.job_role}</span> on{' '}
                {data.role_targets_applied} of {results.length} competencies. A shortfall here means
                a shortfall against what this role requires, not against a single pass mark.
              </>
            ) : (
              <>
                No proficiency targets are defined for this job role yet, so standard thresholds were
                applied: {data.banding_method}.
              </>
            )}
          </p>
        </div>
      </div>
      {ordered.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-bold text-slate-800">Competency breakdown</span>
            {/*
              How thin the thinnest rows are, in the backend's own words. A single
              answer forces 0% or 100%, which is how a one-question competency ended
              up reported as a 65-point critical gap. Said out loud, it cannot pass
              for a finding.
            */}
            {typeof data.low_evidence_competencies === 'number' &&
              data.low_evidence_competencies > 0 && (
                <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  {data.low_evidence_competencies} of {ordered.length} thinly measured
                </span>
              )}
          </div>
          {ordered.map((r) => (
            <div key={r.competency_id} className="p-5 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs font-bold text-slate-800">{r.competency_name}</div>
                <div className="flex items-center gap-2">
                  {typeof r.questions_answered === 'number' && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {r.questions_correct ?? 0}/{r.questions_answered}{' '}
                      {r.questions_answered === 1 ? 'answer' : 'answers'}
                    </span>
                  )}
                  {r.low_evidence && (
                    <span className="text-[10px] font-bold font-mono uppercase px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      low evidence
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-slate-500">
                    {r.score}%
                    {r.target_score !== null && <> / target {r.target_score}%</>}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase font-mono ${
                      STATUS_STYLES[r.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{r.evidence}</p>
              <div className="text-[10px] font-mono text-slate-400 uppercase">
                {r.benchmark === 'role_target' ? 'benchmark: role target' : 'benchmark: standard threshold'}
              </div>
            </div>
          ))}
          {data.evidence_rule && (
            <div className="p-5 text-[10px] font-mono text-slate-400 leading-relaxed">
              {data.evidence_rule}
            </div>
          )}
        </div>
      )}
      {answers.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          <div className="p-5 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" aria-hidden="true" />
            <span className="text-sm font-bold text-slate-800">
              Question review ({answers.filter((a) => !a.is_correct).length} to revisit)
            </span>
          </div>
          {answers.map((a, i) => (
            <div key={a.question_id} className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                {a.is_correct ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="space-y-1 min-w-0">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Q{i + 1} &middot; {a.competency_name} &middot; {a.difficulty}
                  </div>
                  <p className="text-xs font-bold text-slate-900 leading-snug">{a.question_text}</p>
                </div>
              </div>

              <div className="pl-7 space-y-1 text-[11px]">
                <div className={a.is_correct ? 'text-emerald-700' : 'text-rose-700'}>
                  Your answer: <span className="font-semibold">{a.selected_text ?? 'not answered'}</span>
                </div>
                {!a.is_correct && a.correct_text && (
                  <div className="text-emerald-700">
                    Correct answer: <span className="font-semibold">{a.correct_text}</span>
                  </div>
                )}
              </div>

              {a.explanation && (
                <div className="pl-7">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11px] text-slate-700 leading-relaxed">
                    <span className="font-bold text-slate-800">Why: </span>
                    {a.explanation}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
        >
          View full competency analysis <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
