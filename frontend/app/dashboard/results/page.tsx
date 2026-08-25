"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { Award, AlertTriangle, CheckCircle, ArrowRight, HelpCircle, BookOpen } from 'lucide-react';

export default function ResultsPage() {
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    fetch('/api/competency/me')
      .then((res) => res.json())
      .then((data) => {
        setResults(data);
      })
      .catch(() => {});
  }, []);

  const overallScore = results?.overall_score ?? 68.0;
  const compList = results?.competencies || [
    {
      competency_name: 'Statistical Methods & Inference',
      domain: 'Statistical Competencies',
      score: 42.0,
      status: 'critical_gap',
      evidence: 'Missed 3 of 4 questions on sampling errors, design effects, and hypothesis testing.'
    },
    {
      competency_name: 'Survey Design & Sampling Methods',
      domain: 'Statistical Competencies',
      score: 55.0,
      status: 'critical_gap',
      evidence: 'Struggled with complex survey sampling weights and variance estimation.'
    },
    {
      competency_name: 'National Accounts & Price Statistics',
      domain: 'Statistical Competencies',
      score: 65.0,
      status: 'needs_improvement',
      evidence: 'Correctly identified CPI formula but missed base year adjustment concepts.'
    },
    {
      competency_name: 'Data Analysis & Python/R',
      domain: 'Technical Competencies',
      score: 88.0,
      status: 'strong',
      evidence: 'Demonstrated high proficiency in Python data structures and SQL window functions.'
    },
    {
      competency_name: 'Data Privacy & Cybersecurity',
      domain: 'Digital Governance',
      score: 90.0,
      status: 'strong',
      evidence: 'Excellent compliance knowledge regarding DPDP Act and Data Privacy rules.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" userName="Ananya Sharma" />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          {/* Header Banner */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-blue-600 font-bold uppercase">
                Assessment Results & AI Gap Diagnosis
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Competency Evaluation Summary</h1>
              <p className="text-xs text-slate-500 mt-0.5">Categorized into Strong, Needs Improvement, and Critical Gap</p>
            </div>

            <div className="flex items-center space-x-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Overall Score</div>
                <div className="text-3xl font-black text-slate-900">{overallScore}%</div>
              </div>
              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Explainable Gap Evidence Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" /> Transparent Gap Diagnostics
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {compList.map((item: any, idx: number) => {
                const isGap = item.status === 'critical_gap';
                const isImprove = item.status === 'needs_improvement';
                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isGap
                        ? 'bg-rose-50/60 border-rose-200'
                        : isImprove
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-emerald-50/60 border-emerald-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase font-mono ${
                            isGap
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : isImprove
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">{item.domain}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{item.competency_name}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">{item.evidence}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-extrabold text-slate-900">{item.score}%</div>
                      <div className="text-[10px] text-slate-400 font-medium">Domain Score</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA to Generate Personalized Training Path */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-extrabold">Ready to Bridge Your Skill Gaps?</h3>
              <p className="text-xs text-slate-300 mt-1">SkillSetu AI has curated personalized courses from iGOT Karmayogi & NSSTA TPAC.</p>
            </div>
            <Link
              href="/dashboard/learning-path"
              className="bg-blue-500 hover:bg-blue-400 text-white text-xs font-extrabold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2 flex-shrink-0"
            >
              Generate Personalized Training Path <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
