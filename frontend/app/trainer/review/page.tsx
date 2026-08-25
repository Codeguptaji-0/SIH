"use client";

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { CheckCircle2, XCircle, Edit3, Shield, Sparkles, FileCheck } from 'lucide-react';

export default function TrainerReviewPage() {
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/trainer/questions?review_status=PENDING')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.length > 0) {
          setQuestions(data);
        } else {
          // Demo fallback pending question
          setQuestions([
            {
              id: 'q-demo-pending-01',
              competency_name: 'Survey Design & Sampling Methods',
              question_text: 'In multistage cluster sampling for NSS urban frames, what primary unit is selected at Stage 1?',
              options: [
                'Individual Households',
                'Urban Frame Survey (UFS) Blocks',
                'State Planning Districts',
                'Panchayat Samitis'
              ],
              correct_option: 1,
              explanation: 'UFS blocks serve as Primary Sampling Units (PSUs) in NSS urban survey frames.',
              difficulty: 'medium',
              review_status: 'PENDING'
            }
          ]);
        }
      })
      .catch(() => {});
  }, []);

  const handleAction = async (qid: string, action: string) => {
    try {
      await fetch(`/api/trainer/questions/${qid}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      setQuestions((prev) => prev.filter((q) => q.id !== qid));
    } catch (e) {
      setQuestions((prev) => prev.filter((q) => q.id !== qid));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="TRAINER" userName="Dr. V. K. Rao" />

      <div className="flex flex-1">
        <Sidebar role="TRAINER" />

        <main className="flex-1 p-6 sm:p-8 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Human-in-the-Loop Question Review</h1>
              <p className="text-xs text-slate-500 mt-1">
                Trainers verify AI-generated MCQs before they are committed to official learner assessment banks
              </p>
            </div>
            <div className="bg-amber-100 border border-amber-300 text-amber-800 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
              <FileCheck className="w-4 h-4" /> {questions.length} Pending Review
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">All AI MCQs Reviewed</h3>
              <p className="text-xs text-slate-500">No pending questions require human approval at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {q.competency_name}
                    </span>
                    <span className="text-[10px] font-mono text-amber-600 font-bold uppercase">AI Confidence: High</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{q.question_text}</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt: string, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border ${
                          idx === q.correct_option
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}. {opt} {idx === q.correct_option && '✓ (Correct Answer)'}
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <strong>AI Pedagogical Explanation:</strong> {q.explanation}
                  </div>

                  {/* Human Review Actions */}
                  <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleAction(q.id, 'REJECT')}
                      className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                    <button
                      onClick={() => handleAction(q.id, 'APPROVE')}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve & Publish
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
