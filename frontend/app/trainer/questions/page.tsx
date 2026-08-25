"use client";

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { BookOpen, CheckCircle, Clock } from 'lucide-react';

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/trainer/questions')
      .then((res) => res.json())
      .then((data) => setQuestions(data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="TRAINER" userName="Dr. V. K. Rao" />

      <div className="flex flex-1">
        <Sidebar role="TRAINER" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Question Bank Repository</h1>
            <p className="text-xs text-slate-500 mt-1">Verified objective MCQs mapped to MoSPI official statistical domains</p>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q.id || idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {q.competency_name}
                  </span>
                  <span className="text-[10px] font-bold uppercase font-mono px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Status: {q.review_status}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-900">{idx + 1}. {q.question_text}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {q.options.map((opt: string, oIdx: number) => (
                    <div
                      key={oIdx}
                      className={`p-2.5 rounded-xl border font-medium ${
                        oIdx === q.correct_option
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {String.fromCharCode(65 + oIdx)}. {opt} {oIdx === q.correct_option && '✓ (Correct)'}
                    </div>
                  ))}
                </div>

                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
