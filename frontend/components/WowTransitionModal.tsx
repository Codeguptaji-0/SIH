"use client";

import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, Loader2 } from 'lucide-react';

interface WowTransitionModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const WowTransitionModal: React.FC<WowTransitionModalProps> = ({ isOpen, onComplete }) => {
  const [step, setStep] = useState(0);

  const steps = [
    'Evaluating response precision & difficulty weighting...',
    'Mapping 4 MoSPI competency domains...',
    'Identifying knowledge gaps & critical thresholds...',
    'Building personalized iGOT + NSSTA training pathway...'
  ];

  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      return;
    }

    const interval = setInterval(() => {
      setStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setTimeout(onComplete, 800);
          return prev;
        }
      });
    }, 900);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-blue-100">
          <Sparkles className="w-8 h-8 animate-pulse text-blue-600" />
        </div>

        <div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            SkillSetu AI Engine
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Analyzing Performance & Mapping Competencies
          </p>
        </div>

        {/* Step List */}
        <div className="space-y-3 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
          {steps.map((text, idx) => {
            const isDone = idx < step;
            const isCurrent = idx === step;
            return (
              <div key={idx} className="flex items-center space-x-3">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                )}
                <span
                  className={`font-medium ${
                    isDone
                      ? 'text-slate-700 font-semibold'
                      : isCurrent
                      ? 'text-blue-700 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {text}
                </span>
              </div>
            );
          })}
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          Smart India Hackathon 2026 • SIH26101
        </div>
      </div>
    </div>
  );
};
