"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { WowTransitionModal } from '@/components/WowTransitionModal';
import { Award, ArrowRight, ArrowLeft, CheckCircle2, Clock, Shield } from 'lucide-react';

export default function AdaptiveQuizPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWowModal, setShowWowModal] = useState(false);

  useEffect(() => {
    fetch('/api/quizzes/active')
      .then((res) => res.json())
      .then((data) => {
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
        } else {
          // Fallback demo question set
          setQuestions([
            {
              id: 'q-001',
              competency_id: 'comp-stat-001',
              competency_name: 'Statistical Methods & Inference',
              domain: 'Statistical Competencies',
              question_text: 'In hypothesis testing, what occurs during a Type I error?',
              options: [
                'Accepting a false null hypothesis',
                'Rejecting a true null hypothesis',
                'Calculating incorrect sample size',
                'Using parametric tests on non-normal data'
              ],
              correct_option: 1,
              difficulty: 'medium',
              source_reference: 'MoSPI Manual Ch. 2'
            },
            {
              id: 'q-003',
              competency_id: 'comp-stat-002',
              competency_name: 'Survey Design & Sampling Methods',
              domain: 'Statistical Competencies',
              question_text: 'In National Sample Survey (NSS) design, why is Stratified Random Sampling primarily preferred?',
              options: [
                'It completely eliminates non-sampling errors',
                'It ensures proportional representation across heterogeneous sub-populations',
                'It is cheaper than simple random sampling',
                'It eliminates the need for sampling weights'
              ],
              correct_option: 1,
              difficulty: 'hard',
              source_reference: 'NSSO Sampling Design Guide'
            },
            {
              id: 'q-005',
              competency_id: 'comp-stat-003',
              competency_name: 'National Accounts & Price Statistics',
              domain: 'Statistical Competencies',
              question_text: 'Which index formula is currently used for computing the Consumer Price Index (CPI) in India?',
              options: [
                'Laspeyres Price Index',
                'Paasche Price Index',
                'Fisher Ideal Index',
                'Marshall-Edgeworth Index'
              ],
              correct_option: 0,
              difficulty: 'medium',
              source_reference: 'MoSPI Price Statistics Division'
            },
            {
              id: 'q-006',
              competency_id: 'comp-tech-001',
              competency_name: 'Data Analysis & Python/R',
              domain: 'Technical Competencies',
              question_text: 'Which Python library is standard for handling tabular statistical data structures (DataFrames)?',
              options: ['NumPy', 'Pandas', 'SciPy', 'Matplotlib'],
              correct_option: 1,
              difficulty: 'easy',
              source_reference: 'MoSPI Tech Upskilling Module'
            },
            {
              id: 'q-009',
              competency_id: 'comp-gov-001',
              competency_name: 'Data Privacy & Cybersecurity',
              domain: 'Digital Governance',
              question_text: 'Under the Digital Personal Data Protection (DPDP) Act, what is required before processing personal survey data?',
              options: [
                'Prior written approval from NITI Aayog',
                'Clear, informed consent or lawful public mandate',
                'Biometric verification of all respondents',
                'Encryption using 4096-bit keys'
              ],
              correct_option: 1,
              difficulty: 'medium',
              source_reference: 'Digital Governance Framework'
            }
          ]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelectOption = (optionIdx: number) => {
    const currentQ = questions[currentIndex];
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionIdx
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    setIsSubmitting(true);
    const payloadAnswers = Object.entries(userAnswers).map(([qid, opt]) => ({
      question_id: qid,
      selected_option: opt
    }));

    try {
      await fetch('/api/quizzes/active-quiz-session-001/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payloadAnswers })
      });
    } catch (err) {
      console.error(err);
    }

    // Trigger WOW animation modal
    setShowWowModal(true);
  };

  const handleWowModalComplete = () => {
    router.push('/dashboard/results');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="text-center font-mono text-sm">Loading Adaptive Quiz Session...</div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const selectedOpt = userAnswers[currentQ?.id];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" userName="Ananya Sharma" />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
          {/* Progress Indicator Header */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-blue-600 font-bold">
                QUESTION {currentIndex + 1} OF {questions.length}
              </div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">
                Competency: <span className="text-blue-700">{currentQ?.competency_name}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full font-mono uppercase ${
                currentQ?.difficulty === 'hard' ? 'bg-rose-100 text-rose-700 border border-rose-200' : (currentQ?.difficulty === 'medium' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200')
              }`}>
                Difficulty: {currentQ?.difficulty}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>

          {/* Question Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {currentQ?.question_text}
            </h2>

            <div className="space-y-3">
              {currentQ?.options.map((opt: str, idx: number) => {
                const isSelected = selectedOpt === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full text-left p-4 rounded-2xl border text-xs font-medium transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span>{opt}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 font-mono border-t border-slate-100 pt-3">
              Source Reference: {currentQ?.source_reference}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>

            {currentIndex === questions.length - 1 ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={isSubmitting}
                className="px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
              >
                Analyze My Competency <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2"
              >
                Next Question <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </main>
      </div>

      <WowTransitionModal isOpen={showWowModal} onComplete={handleWowModalComplete} />
    </div>
  );
}
