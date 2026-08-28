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
  easy: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  hard: 'bg-rose-100 text-rose-800 border-rose-300',
};

function levelBadge(level?: string): string {
  return LEVEL_STYLES[(level || '').toLowerCase()] || 'bg-slate-100 text-slate-700 border-slate-300';
}

/** Direction of a ladder move, used to pick the arrow and its colour. */
function moveKind(before?: string, after?: string): 'up' | 'down' | 'hold' {
  const b = LEVELS.indexOf((before || '') as any);
  const a = LEVELS.indexOf((after || '') as any);
  if (b < 0 || a < 0 || a === b) return 'hold';
  return a > b ? 'up' : 'down';
}

function MoveIcon({ kind }: { kind: 'up' | 'down' | 'hold' }) {
  if (kind === 'up') return <ChevronsUp className="w-4 h-4 text-rose-600" />;
  if (kind === 'down') return <ChevronsDown className="w-4 h-4 text-emerald-600" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
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
          <div key={lv} className="flex flex-col items-center gap-1">
            <div
              className={`w-12 rounded-t-md border transition-all ${height} ${
                isActive ? levelBadge(lv) : 'bg-slate-100 border-slate-200'
              }`}
            />
            <span
              className={`text-[10px] font-mono font-bold uppercase ${
                isActive ? 'text-slate-900' : 'text-slate-400'
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-6xl mx-auto space-y-6 w-full">
          <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                {t('navAdaptive')}
              </h1>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                {t('adaptiveSubtitle')}
              </p>
            </div>
            {!inRun && !result && (
              <button
                onClick={() => start(10)}
                disabled={starting}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-5 py-3 rounded-xl shadow-lg text-xs flex-shrink-0"
              >
                {starting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {t('adaptiveStart')}
              </button>
            )}
          </header>

          {error && (
            <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4" /> {t('adaptiveError')}
              </div>
              <p className="text-xs text-rose-700 font-mono break-words">{error}</p>
            </div>
          )}

          {emptyPool && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <h2 className="text-sm font-bold text-slate-800">{t('adaptiveNoPool')}</h2>
              <p className="text-xs text-slate-500 max-w-2xl">{emptyPool}</p>
              {typeof poolSize === 'number' && (
                <p className="text-[11px] text-slate-400 font-mono">
                  approved_pool_size: {poolSize}
                </p>
              )}
              <Link
                href="/trainer/review"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 pt-1"
              >
                {t('adaptiveGoReview')} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {(inRun || result) && (
            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    {t('adaptiveCurrentLevel')}
                  </span>
                  <div className="flex items-end gap-4">
                    <LadderRail level={level} />
                    <span
                      className={`text-xs font-bold font-mono uppercase px-3 py-1.5 rounded-full border ${levelBadge(level)}`}
                    >
                      {level || '-'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 md:max-w-xs space-y-2">
                  <div className="flex justify-between text-[11px] font-mono text-slate-500">
                    <span>
                      {t('adaptiveAnswered')}: {answeredSoFar}/{maxQuestions}
                    </span>
                    <span>
                      {t('adaptiveCorrect')}: {progress.correct}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {ladder && (
                    <p className="text-[11px] text-slate-500 font-mono">
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
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{notice}</p>
            </div>
          )}

          {lastAnswer && (
            <section
              className={`p-5 rounded-2xl border shadow-sm space-y-3 ${
                lastAnswer.is_correct
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {lastAnswer.is_correct ? (
                  <Check className="w-4 h-4 text-emerald-700" />
                ) : (
                  <X className="w-4 h-4 text-rose-700" />
                )}
                <span
                  className={`text-sm font-bold ${
                    lastAnswer.is_correct ? 'text-emerald-900' : 'text-rose-900'
                  }`}
                >
                  {lastAnswer.is_correct ? t('adaptiveCorrectAnswer') : t('adaptiveWrongAnswer')}
                </span>
                <span className="text-[10px] font-mono text-slate-500 ml-auto">
                  {lastAnswer.difficulty} · weight {lastAnswer.weight}
                </span>
              </div>

              {/* The ladder move, stated as the server stated it. This is the whole
                  point of the screen: the level change and its reason, in words. */}
              <div className="bg-white/70 border border-white rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-bold font-mono uppercase px-2 py-1 rounded border ${levelBadge(ladder?.level_before)}`}
                  >
                    {ladder?.level_before || '-'}
                  </span>
                  <MoveIcon kind={moveKind(ladder?.level_before, ladder?.level_after)} />
                  <span
                    className={`text-[10px] font-bold font-mono uppercase px-2 py-1 rounded border ${levelBadge(ladder?.level_after)}`}
                  >
                    {ladder?.level_after || '-'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider ml-1">
                    {t('adaptiveLadderMove')}
                  </span>
                </div>
                <p className="text-xs text-slate-700 italic">
                  {ladder?.adaptation_reason || '-'}
                </p>
              </div>

              {lastAnswer.explanation && (
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                    {t('adaptiveExplanation')}
                  </span>
                  <p className="text-xs text-slate-700 mt-1">{lastAnswer.explanation}</p>
                </div>
              )}
            </section>
          )}

          {inRun && (
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    {t('adaptiveQuestion')} {answeredSoFar + 1}/{maxQuestions}
                  </span>
                  <h2 className="text-base font-bold text-slate-900 mt-1.5 leading-snug">
                    {question.question_text}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    {question.competency_name || 'Competency not recorded'}
                    {question.domain ? ` · ${question.domain}` : ''}
                    {question.source_reference ? ` · ${question.source_reference}` : ''}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold font-mono uppercase px-2.5 py-1 rounded-full border flex-shrink-0 ${levelBadge(question.difficulty)}`}
                >
                  {question.difficulty}
                </span>
              </div>

              <div className="space-y-2">
                {(question.options || []).map((opt, idx) => {
                  const isPicked = selected === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelected(idx)}
                      disabled={submitting}
                      className={`w-full text-left flex items-center gap-3 p-3.5 rounded-xl border text-xs transition-all disabled:opacity-60 ${
                        isPicked
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono flex-shrink-0 ${
                          isPicked ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={submit}
                disabled={selected === null || submitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl shadow-lg text-xs"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('adaptiveSubmit')} <ArrowRight className="w-4 h-4" />
              </button>
            </section>
          )}

          {trail.length > 0 && (
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{t('adaptiveTrail')}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{t('adaptiveTrailHint')}</p>
              </div>
              <div className="space-y-1.5">
                {trail.map((e) => (
                  <div
                    key={e.question_number}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex-wrap"
                  >
                    <span className="text-[10px] font-mono font-bold text-slate-400 w-6 flex-shrink-0">
                      Q{e.question_number}
                    </span>
                    {e.is_correct ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                    )}
                    <span
                      className={`text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded border ${levelBadge(e.level_before)}`}
                    >
                      {e.level_before}
                    </span>
                    <MoveIcon kind={moveKind(e.level_before, e.level_after)} />
                    <span
                      className={`text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded border ${levelBadge(e.level_after)}`}
                    >
                      {e.level_after}
                    </span>
                    <span className="text-[11px] text-slate-600 italic flex-1 min-w-[12rem]">
                      {e.adaptation_reason}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                      ×{e.weight}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {result && (
            <section className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-6 rounded-3xl shadow-md border border-blue-800 space-y-5">
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <span className="text-[10px] font-mono text-blue-300 font-bold uppercase tracking-wider">
                    {t('adaptiveWeightedScore')}
                  </span>
                  <p className="text-3xl font-extrabold mt-0.5">
                    {typeof result.overall_score === 'number' ? result.overall_score.toFixed(1) : '-'}
                    <span className="text-base font-bold text-slate-400">%</span>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-blue-300 font-bold uppercase tracking-wider">
                    {t('adaptiveRawScore')}
                  </span>
                  <p className="text-lg font-bold mt-1">
                    {typeof result.raw_score === 'number' ? `${result.raw_score.toFixed(1)}%` : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-blue-300 font-bold uppercase tracking-wider">
                    {t('adaptiveFinalLevel')}
                  </span>
                  <p className="text-lg font-bold mt-1 uppercase font-mono">
                    {result.final_level || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-blue-300 font-bold uppercase tracking-wider">
                    {t('adaptiveCorrect')}
                  </span>
                  <p className="text-lg font-bold mt-1">
                    {result.correct_answers ?? 0}/{result.total_questions ?? 0}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 font-mono">
                scoring_method: {result.scoring_method || 'not reported'}
              </p>

              {(result.competency_results || []).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-blue-300 font-bold uppercase tracking-wider">
                    {t('adaptivePerCompetency')}
                  </span>
                  {(result.competency_results || []).map((cr, idx) => (
                    <div
                      key={cr.competency_id || idx}
                      className="bg-white/10 border border-white/10 rounded-xl p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-xs font-bold">
                          {cr.competency_name || cr.competency_id}
                        </span>
                        <span className="text-[10px] font-mono text-slate-300 flex items-center gap-2">
                          {typeof cr.questions_answered === 'number' && (
                            <span className="text-slate-400">
                              {cr.questions_correct ?? 0}/{cr.questions_answered}{' '}
                              {t('adaptiveAnswersCounted')}
                            </span>
                          )}
                          {cr.low_evidence && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 uppercase font-bold">
                              {t('adaptiveLowEvidence')}
                            </span>
                          )}
                          <span>
                            {typeof cr.score === 'number' ? `${cr.score.toFixed(1)}%` : '-'} ·{' '}
                            {cr.status} · {cr.priority}
                          </span>
                        </span>
                      </div>
                      {cr.evidence && (
                        <p className="text-[11px] text-slate-300">{cr.evidence}</p>
                      )}
                    </div>
                  ))}
                  {result.evidence_rule && (
                    <p className="text-[10px] font-mono text-slate-400 leading-relaxed">
                      {result.evidence_rule}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={() => start(10)}
                  disabled={starting}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs"
                >
                  {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {t('adaptiveRestart')}
                </button>
                <Link
                  href="/dashboard/learning-path"
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-5 py-2.5 rounded-xl text-xs"
                >
                  {t('viewLearningPath')} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {sessionId && (
                <p className="text-[10px] text-slate-400 font-mono break-all">
                  {t('adaptiveAuditHint')} GET /api/quizzes/adaptive/{sessionId}
                </p>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
