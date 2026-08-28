"use client";

import React, { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * Post-submission confirmation.
 *
 * What this component used to be: a 4.4-second animated "SkillSetu AI Engine"
 * pipeline that stepped through "Evaluating response precision & difficulty
 * weighting...", "Mapping 4 MoSPI competency domains...", and two more lines on a
 * 900ms timer, with spinners moving to green ticks.
 *
 * None of that work was happening. The quiz page opens this modal only *after*
 * POST /api/quizzes/{id}/submit has already returned the finished score, so the
 * animation narrated a computation that had finished before the first frame - and
 * called arithmetic an "AI Engine" while doing it. It also delayed the officer's
 * real result by four seconds.
 *
 * So this is now a plain confirmation. It states what the server did, in the past
 * tense, and hands over on a click. The props are unchanged, so the caller did not
 * need to change.
 */

interface WowTransitionModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

/** Facts about the scoring that already ran, not a simulated progress list. */
const WHAT_THE_SERVER_DID = [
  'Graded each answer against the correct option stored with the question.',
  'Weighted the score by question difficulty rather than counting answers equally.',
  'Banded every competency against your job-role target where one is defined.',
  'Flagged any competency measured by too few answers to be treated as a finding.',
];

export const WowTransitionModal: React.FC<WowTransitionModalProps> = ({ isOpen, onComplete }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog, and let Escape dismiss it.
  useEffect(() => {
    if (!isOpen) return;
    buttonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onComplete();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scored-title"
    >
      <div className="w-full max-w-md border-2 border-ink bg-white">
        <div className="border-b border-rule px-5 py-4">
          <p className="eyebrow">Submission recorded</p>
          <h2
            id="scored-title"
            className="mt-2 font-display text-xl font-semibold tracking-tight text-ink"
          >
            Your answers have been scored
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Scoring ran on the server when you submitted. Nothing is being calculated now.
          </p>
        </div>

        <ol className="m-0 list-none p-0">
          {WHAT_THE_SERVER_DID.map((line, idx) => (
            <li key={idx} className="flex items-baseline gap-3 border-b border-rule px-5 py-2.5">
              <span className="font-mono text-[11px] text-slate-400 tnum">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span className="text-xs leading-relaxed text-slate-600">{line}</span>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate-400">
            SIH 2026 · SIH26101
          </p>
          <button
            ref={buttonRef}
            type="button"
            onClick={onComplete}
            className="inline-flex h-11 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
          >
            View my results <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
