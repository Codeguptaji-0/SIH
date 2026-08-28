"use client";

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronsDown,
  ChevronsUp,
  Loader2,
  Minus,
  Play,
  X,
} from 'lucide-react';
import { ApiError, apiJson } from '@/app/lib/api';
import { useLanguage } from '@/app/context/LanguageContext';

/**
 * Adaptive Assessment.
 *
 * The engine's difficulty ladder (CompetencyEngine.next_difficulty) is served by
 * three endpoints:
 *   POST /api/quizzes/adaptive/start              -> session_id + first question
 *   POST /api/quizzes/adaptive/{session_id}/answer -> grading + ladder move + next question
 *   GET  /api/quizzes/adaptive/{session_id}        -> replayable audit trail
 *
 * This screen exists so the adaptation is *visible*. After every answer the
 * backend returns level_before, level_after and its own adaptation_reason string,
 * and all three are rendered rather than summarised, because "the difficulty
 * adapts" is only credible if you can watch the level move and read why.
 *
 * The client never decides the level. It submits one answer and is told what to
 * show next, so the displayed ladder is the server's record, not a local guess.
 */

const LEVELS = ['easy', 'medium', 'hard'] as const;

interface ServedQuestion {
  id?: string;
  competency_name?: string;
  domain?: string;
  question_text?: string;
  options?: string[];
  difficulty?: string;
  source_reference?: string;
}

interface Ladder {
  level_before?: string;
  level_after?: string;
  adaptation_reason?: string;
  consecutive_correct?: number;
  consecutive_wrong?: number;
  step_up_after?: number;
  step_down_after?: number;
  level_substituted?: boolean;
}

interface Answered {
  question_id?: string;
  is_correct?: boolean;
  correct_option?: number;
  explanation?: string;
  difficulty?: string;
  weight?: number;
}

interface TrailEntry {
  question_number?: number;
  difficulty?: string;
  weight?: number;
  is_correct?: boolean;
  level_before?: string;
  level_after?: string;
  adaptation_reason?: string;
}

interface CompetencyRow {
  competency_id?: string;
  competency_name?: string;
  score?: number;
  status?: string;
  priority?: string;
  evidence?: string;
  // How many answers the band rests on. One answer can only score 0% or 100%, so a
  // thinly measured row is labelled rather than shown as a settled finding.
  questions_answered?: number;
  questions_correct?: number;
  low_evidence?: boolean;
}

interface AdaptiveResult {
  overall_score?: number;
  raw_score?: number;
  scoring_method?: string;
  total_questions?: number;
  correct_answers?: number;
  final_level?: string;
  attempt_id?: string;
  competency_results?: CompetencyRow[];
  competencies_measured?: number;
  low_evidence_competencies?: number;
  evidence_rule?: string;
}

interface StartResponse {
  session_id?: string;
  current_level?: string;
  max_questions?: number;
  approved_pool_size?: number;
  ladder?: Ladder;
  question?: ServedQuestion;
  message?: string;
}

interface AnswerResponse {
  session_id?: string;
  answered?: Answered;
  ladder?: Ladder;
  progress?: { answered?: number; correct?: number; max_questions?: number };
  question?: ServedQuestion;
  completed?: boolean;
  message?: string;
  result?: AdaptiveResult;
}

function describeError(e: unknown): string {
  if (e instanceof ApiError) return `${e.message} (HTTP ${e.status})`;
  return 'Cannot reach the SkillSetu backend. Start it with: uvicorn app.main:app --reload';
}

const LEVEL_STYLES: Record<string, string> = {
  easy: 'border-strong-200 bg-strong-50 text-strong-700',
  medium: 'border-watch-200 bg-watch-50 text-watch-700',
  hard: 'border-gap-200 bg-gap-50 text-gap-700',
};

function levelBadge(level?: string): string {
  return LEVEL_STYLES[(level || '').toLowerCase()] || 'border-rule bg-paper-sunken text-slate-500';
}

/** Direction of a ladder move, used to pick the arrow and its colour. */
function moveKind(before?: string, after?: string): 'up' | 'down' | 'hold' {
  const b = LEVELS.indexOf((before || '') as any);
  const a = LEVELS.indexOf((after || '') as any);
  if (b < 0 || a < 0 || a === b) return 'hold';
  return a > b ? 'up' : 'down';
}

function MoveIcon({ kind }: { kind: 'up' | 'down' | 'hold' }) {
  if (kind === 'up') return <ChevronsUp className="h-4 w-4 text-gap-600" aria-hidden="true" />;
  if (kind === 'down') return <ChevronsDown className="h-4 w-4 text-strong-600" aria-hidden="true" />;
  return <Minus className="h-4 w-4 text-slate-400" aria-hidden="true" />;
}

/**
 * The three rungs, with the live one highlighted.
 *
 * Rendered from the session's current_level rather than from a local counter, so
 * it cannot drift away from what the server believes.
 */
function LadderRail({ level }: { level?: string }) {
  const active = (level || '').toLowerCase();
  return (
    <div className="flex items-end gap-1.5">
      {[...LEVELS].reverse().map((lv) => {
        const isActive = lv === active;
        const height = lv === 'hard' ? 'h-10' : lv === 'medium' ? 'h-7' : 'h-4';
        return (
          <div key={lv} className="flex flex-col items-center gap-1.5">
            <div
              className={`w-10 border ${height} ${
                isActive ? 'border-ink bg-navy-600' : 'border-rule bg-paper-sunken'
              }`}
            />
            <span
              className={`font-mono text-[10px] uppercase tracking-eyebrow ${
                isActive ? 'text-ink' : 'text-slate-400'
              }`}
            >
              {lv}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdaptiveAssessmentPage() {
  const { t } = useLanguage();

  const [sessionId, setSessionId] = useState<string>(null);
  const [level, setLevel] = useState<string>(null);
  const [maxQuestions, setMaxQuestions] = useState<number>(10);
  const [poolSize, setPoolSize] = useState<number>(null);
  const [question, setQuestion] = useState<ServedQuestion>(null);
  const [selected, setSelected] = useState<number>(null);
  const [ladder, setLadder] = useState<Ladder>(null);
  const [lastAnswer, setLastAnswer] = useState<Answered>(null);
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const [progress, setProgress] = useState<{ answered: number; correct: number }>({
    answered: 0,
    correct: 0,
  });
  const [result, setResult] = useState<AdaptiveResult>(null);
  const [notice, setNotice] = useState<string>(null);
  const [error, setError] = useState<string>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emptyPool, setEmptyPool] = useState<string>(null);

  const start = useCallback(async (requested: number) => {
    setStarting(true);
    setError(null);
    setNotice(null);
    setEmptyPool(null);
    setResult(null);
    setTrail([]);
    setLastAnswer(null);
    setSelected(null);
    setProgress({ answered: 0, correct: 0 });

    try {
      const res = await apiJson<StartResponse>('/api/quizzes/adaptive/start', {
        method: 'POST',
        body: JSON.stringify({ max_questions: requested, starting_level: 'medium' }),
      });

      if (typeof res.approved_pool_size === 'number') setPoolSize(res.approved_pool_size);

      // The backend returns session_id: null when no trainer-approved question
      // exists. That is a real state, not an error, so its own message is shown.
      if (!res.session_id || !res.question) {
        setSessionId(null);
        setQuestion(null);
        setEmptyPool(res.message || 'No trainer-approved questions are available yet.');
        return;
      }

      setSessionId(res.session_id);
      setQuestion(res.question);
      setLevel(res.current_level || res.question.difficulty);
      setMaxQuestions(res.max_questions || requested);
      setLadder(res.ladder || null);
      if (res.message) setNotice(res.message);
    } catch (e) {
      setError(describeError(e));
      setSessionId(null);
      setQuestion(null);
    } finally {
      setStarting(false);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!sessionId || !question?.id || selected === null) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const res = await apiJson<AnswerResponse>(
        `/api/quizzes/adaptive/${encodeURIComponent(sessionId)}/answer`,
        {
          method: 'POST',
          body: JSON.stringify({ question_id: question.id, selected_option: selected }),
        }
      );

      const move = res.ladder || {};
      setLadder(move);
      setLastAnswer(res.answered || null);
      setLevel(move.level_after || level);
      setProgress({
        answered: res.progress?.answered ?? 0,
        correct: res.progress?.correct ?? 0,
      });

      // The trail is appended locally from the same fields the server persists, so
      // the history panel and the audit endpoint tell the same story.
      setTrail((prev) => [
        ...prev,
        {
          question_number: prev.length + 1,
          difficulty: res.answered?.difficulty,
          weight: res.answered?.weight,
          is_correct: res.answered?.is_correct,
          level_before: move.level_before,
          level_after: move.level_after,
          adaptation_reason: move.adaptation_reason,
        },
      ]);

      if (res.message) setNotice(res.message);

      if (res.completed) {
        setQuestion(null);
        setResult(res.result || null);
      } else {
        setQuestion(res.question || null);
      }
      setSelected(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, question, selected, level]);

  const answeredSoFar = progress.answered;
  const pct = maxQuestions > 0 ? Math.round((answeredSoFar / maxQuestions) * 100) : 0;
  const inRun = !!sessionId && !!question;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-8">
          <header className="flex flex-col justify-between gap-4 border-b-2 border-ink pb-6 md:flex-row md:items-end">
            <div className="min-w-0">
              <p className="eyebrow">Adaptive run</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
                {t('navAdaptive')}
              </h1>
              <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
                {t('adaptiveSubtitle')}
              </p>
            </div>
            {!inRun && !result && (
              <button
                onClick={() => start(10)}
                disabled={starting}
                className="inline-flex h-11 shrink-0 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700 disabled:opacity-50"
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
                {t('adaptiveStart')}
              </button>
            )}
          </header>

          <div className="mt-8 space-y-8">

          {error && (
            <div role="alert" className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-ink">{t('adaptiveError')}</h2>
                <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{error}</p>
              </div>
            </div>
          )}

          {emptyPool && (
            <div className="border border-rule bg-white px-5 py-5">
              <h2 className="text-sm font-medium text-ink">{t('adaptiveNoPool')}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{emptyPool}</p>
              {typeof poolSize === 'number' && (
                <p className="mt-2 font-mono text-[11px] text-slate-400 tnum">
                  approved_pool_size: {poolSize}
                </p>
              )}
              <Link
                href="/trainer/review"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-navy-600 underline decoration-navy-200 underline-offset-4 hover:decoration-navy-600"
              >
                {t('adaptiveGoReview')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}

          {(inRun || result) && (
            <section className="border border-rule bg-white px-5 py-5">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div>
                  <p className="eyebrow">{t('adaptiveCurrentLevel')}</p>
                  <div className="mt-2.5 flex items-end gap-4">
                    <LadderRail level={level} />
                    <span
                      className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-eyebrow ${levelBadge(level)}`}
                    >
                      {level || '—'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 md:max-w-xs">
                  <div className="flex justify-between font-mono text-[11px] text-slate-500 tnum">
                    <span>
                      {t('adaptiveAnswered')}: {answeredSoFar}/{maxQuestions}
                    </span>
                    <span>
                      {t('adaptiveCorrect')}: {progress.correct}
                    </span>
                  </div>
                  <div className="mt-2 h-[6px] w-full bg-paper-sunken" aria-hidden="true">
                    <div className="h-full bg-navy-600" style={{ width: `${pct}%` }} />
                  </div>
                  {ladder && (
                    <p className="mt-2 font-mono text-[11px] text-slate-500 tnum">
                      {t('adaptiveStreak')}: +{ladder.consecutive_correct ?? 0}/
                      {ladder.step_up_after ?? 2} · -{ladder.consecutive_wrong ?? 0}/
                      {ladder.step_down_after ?? 2}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {notice && (
            <div className="border-l-2 border-watch-500 bg-watch-50 px-4 py-3">
              <p className="text-xs leading-relaxed text-watch-700">{notice}</p>
            </div>
          )}

          {lastAnswer && (
            <section
              className={`border border-rule border-l-2 bg-white px-5 py-5 ${
                lastAnswer.is_correct ? 'border-l-strong-600' : 'border-l-gap-600'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  {lastAnswer.is_correct ? (
                    <Check className="h-4 w-4 text-strong-600" aria-hidden="true" />
                  ) : (
                    <X className="h-4 w-4 text-gap-600" aria-hidden="true" />
                  )}
                  <h2
                    className={`text-sm font-medium ${
                      lastAnswer.is_correct ? 'text-strong-700' : 'text-gap-700'
                    }`}
                  >
                    {lastAnswer.is_correct ? t('adaptiveCorrectAnswer') : t('adaptiveWrongAnswer')}
                  </h2>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-slate-400">
                  {lastAnswer.difficulty} · weight {lastAnswer.weight}
                </span>
              </div>

              {/* The ladder move, stated as the server stated it. This is the whole
                  point of the screen: the level change and its reason, in words. */}
              <div className="mt-3.5 border-t border-rule pt-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${levelBadge(ladder?.level_before)}`}
                  >
                    {ladder?.level_before || '—'}
                  </span>
                  <MoveIcon kind={moveKind(ladder?.level_before, ladder?.level_after)} />
                  <span
                    className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${levelBadge(ladder?.level_after)}`}
                  >
                    {ladder?.level_after || '—'}
                  </span>
                  <span className="eyebrow ml-1">{t('adaptiveLadderMove')}</span>
                </div>
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-600">
                  {ladder?.adaptation_reason || '—'}
                </p>
              </div>

              {lastAnswer.explanation && (
                <div className="mt-3.5 border-t border-rule pt-3.5">
                  <p className="eyebrow">{t('adaptiveExplanation')}</p>
                  <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-600">
                    {lastAnswer.explanation}
                  </p>
                </div>
              )}
            </section>
          )}

          {inRun && (
            <section className="border border-ink bg-white px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule pb-4">
                <div className="min-w-0">
                  <p className="eyebrow">
                    {t('adaptiveQuestion')} {answeredSoFar + 1}/{maxQuestions}
                  </p>
                  <h2 className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight text-ink">
                    {question.question_text}
                  </h2>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {question.competency_name || 'Competency not recorded'}
                    {question.domain ? ` · ${question.domain}` : ''}
                    {question.source_reference ? ` · ${question.source_reference}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-eyebrow ${levelBadge(question.difficulty)}`}
                >
                  {question.difficulty}
                </span>
              </div>

              <ol className="m-0 list-none p-0">
                {(question.options || []).map((opt, idx) => {
                  const isPicked = selected === idx;
                  return (
                    <li key={idx} className="border-b border-rule">
                      <button
                        onClick={() => setSelected(idx)}
                        disabled={submitting}
                        aria-pressed={isPicked}
                        className={`flex w-full items-baseline gap-3 border-l-2 px-3 py-3.5 text-left text-xs transition-colors disabled:opacity-60 ${
                          isPicked
                            ? 'border-l-navy-600 bg-paper-sunken text-ink'
                            : 'border-l-transparent text-slate-600 hover:border-l-rule-strong'
                        }`}
                      >
                        <span
                          className={`font-mono text-[11px] ${
                            isPicked ? 'text-navy-700' : 'text-slate-400'
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="leading-relaxed">{opt}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              <button
                onClick={submit}
                disabled={selected === null || submitting}
                className="mt-5 inline-flex h-11 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {t('adaptiveSubmit')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </section>
          )}

          {trail.length > 0 && (
            <section>
              <div className="border-b border-ink pb-2.5">
                <p className="eyebrow">{t('adaptiveTrail')}</p>
                <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                  {t('adaptiveTrailHint')}
                </p>
              </div>
              <ol className="m-0 mt-1 list-none p-0">
                {trail.map((e) => (
                  <li
                    key={e.question_number}
                    className="flex flex-wrap items-center gap-3 border-b border-rule py-3"
                  >
                    <span className="w-7 shrink-0 font-mono text-[11px] text-slate-400 tnum">
                      Q{e.question_number}
                    </span>
                    {e.is_correct ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-strong-600" aria-hidden="true" />
                    ) : (
                      <X className="h-3.5 w-3.5 shrink-0 text-gap-600" aria-hidden="true" />
                    )}
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${levelBadge(e.level_before)}`}
                    >
                      {e.level_before}
                    </span>
                    <MoveIcon kind={moveKind(e.level_before, e.level_after)} />
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${levelBadge(e.level_after)}`}
                    >
                      {e.level_after}
                    </span>
                    <span className="min-w-[12rem] flex-1 text-[11px] leading-relaxed text-slate-600">
                      {e.adaptation_reason}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400 tnum">
                      ×{e.weight}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {result && (
            <section className="border-2 border-ink bg-white">
              <div className="border-b border-rule px-5 py-4">
                <p className="eyebrow">Run complete</p>
                <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-ink">
                  Adaptive run result
                </h2>
              </div>

              <dl className="m-0 grid grid-cols-2 gap-px bg-rule sm:grid-cols-4">
                <div className="bg-white px-4 py-4">
                  <dt className="eyebrow">{t('adaptiveWeightedScore')}</dt>
                  <dd className="mt-2 font-display text-3xl font-semibold text-ink tnum">
                    {typeof result.overall_score === 'number'
                      ? `${result.overall_score.toFixed(1)}%`
                      : '—'}
                  </dd>
                </div>
                <div className="bg-white px-4 py-4">
                  <dt className="eyebrow">{t('adaptiveRawScore')}</dt>
                  <dd className="mt-2 font-display text-3xl font-semibold text-ink tnum">
                    {typeof result.raw_score === 'number' ? `${result.raw_score.toFixed(1)}%` : '—'}
                  </dd>
                </div>
                <div className="bg-white px-4 py-4">
                  <dt className="eyebrow">{t('adaptiveFinalLevel')}</dt>
                  <dd className="mt-2 font-mono text-sm uppercase tracking-eyebrow text-ink">
                    {result.final_level || '—'}
                  </dd>
                </div>
                <div className="bg-white px-4 py-4">
                  <dt className="eyebrow">{t('adaptiveCorrect')}</dt>
                  <dd className="mt-2 font-display text-3xl font-semibold text-ink tnum">
                    {result.correct_answers ?? 0}/{result.total_questions ?? 0}
                  </dd>
                </div>
              </dl>

              <div className="border-t border-rule px-5 py-4">
                <p className="font-mono text-[11px] text-slate-400">
                  scoring_method: {result.scoring_method || 'not reported'}
                </p>
              </div>

              {(result.competency_results || []).length > 0 && (
                <div className="border-t border-rule px-5 py-5">
                  <p className="eyebrow">{t('adaptivePerCompetency')}</p>
                  <ol className="m-0 mt-1 list-none p-0">
                    {(result.competency_results || []).map((cr, idx) => (
                      <li key={cr.competency_id || idx} className="border-b border-rule py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <h3 className="text-sm font-medium text-ink">
                            {cr.competency_name || cr.competency_id}
                          </h3>
                          <span className="flex flex-wrap items-baseline gap-2.5 font-mono text-[10px] text-slate-500">
                            {typeof cr.questions_answered === 'number' && (
                              <span className="tnum">
                                {cr.questions_correct ?? 0}/{cr.questions_answered}{' '}
                                {t('adaptiveAnswersCounted')}
                              </span>
                            )}
                            {cr.low_evidence && (
                              <span className="border border-watch-200 bg-watch-50 px-2 py-0.5 uppercase tracking-eyebrow text-watch-700">
                                {t('adaptiveLowEvidence')}
                              </span>
                            )}
                            <span className="text-ink tnum">
                              {typeof cr.score === 'number' ? `${cr.score.toFixed(1)}%` : '—'}
                            </span>
                            <span className="uppercase tracking-eyebrow">
                              {cr.status} · {cr.priority}
                            </span>
                          </span>
                        </div>
                        {cr.evidence && (
                          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-600">
                            {cr.evidence}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                  {result.evidence_rule && (
                    <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-slate-400">
                      {result.evidence_rule}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-rule px-5 py-4">
                <button
                  onClick={() => start(10)}
                  disabled={starting}
                  className="inline-flex h-11 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700 disabled:opacity-50"
                >
                  {starting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="h-4 w-4" aria-hidden="true" />
                  )}
                  {t('adaptiveRestart')}
                </button>
                <Link
                  href="/dashboard/learning-path"
                  className="inline-flex h-11 items-center gap-2 border border-rule-strong bg-white px-5 text-sm font-medium text-ink transition-colors hover:border-ink"
                >
                  {t('viewLearningPath')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              {sessionId && (
                <p className="break-all border-t border-rule px-5 py-3 font-mono text-[10px] text-slate-400">
                  {t('adaptiveAuditHint')} GET /api/quizzes/adaptive/{sessionId}
                </p>
              )}
            </section>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
