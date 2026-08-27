"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { BookOpen, CheckCircle, Clock, ExternalLink, ArrowRight, Shield } from 'lucide-react';
import { apiFetch } from '@/app/lib/api';

export default function LearningPathPage() {
  const [learningPath, setLearningPath] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/api/recommendations')
      .then((res) => res.json())
      .then((data) => {
        if (data.learning_path && data.learning_path.length > 0) {
          setLearningPath(data.learning_path);
        } else {
          // Default recommended path
          setLearningPath([
            {
              id: 'lp-001',
              course_id: 'NSSTA-TPAC-STAT-101',
              course_title: 'Advanced Survey Sampling & Weight Calibration',
              competency_name: 'Survey Design & Sampling Methods',
              provider: 'NSSTA TPAC',
              priority: 'High',
              estimated_duration: '4 hours',
              status: 'IN_PROGRESS'
            },
            {
              id: 'lp-002',
              course_id: 'IGOT-STAT-204',
              course_title: 'Statistical Inference & Hypothesis Testing in Practice',
              competency_name: 'Statistical Methods & Inference',
              provider: 'iGOT Karmayogi',
              priority: 'High',
              estimated_duration: '3 hours',
              status: 'ASSIGNED'
            },
            {
              id: 'lp-003',
              course_id: 'IGOT-ECON-102',
              course_title: 'National Accounts Statistics & Inflation Metrics',
              competency_name: 'National Accounts & Price Statistics',
              provider: 'iGOT Karmayogi',
              priority: 'Medium',
              estimated_duration: '2.5 hours',
              status: 'ASSIGNED'
            },
            {
              id: 'lp-004',
              course_id: 'NSSTA-TECH-301',
              course_title: 'SDMX Metadata Standards & Open Data Publishing',
              competency_name: 'Official Statistics & Visualization',
              provider: 'NSSTA TPAC',
              priority: 'Medium',
              estimated_duration: '2 hours',
              status: 'ASSIGNED'
            }
          ]);
        }
      })
      .catch(() => {});
  }, []);

  const handleComplete = async (itemId: string) => {
    try {
      await apiFetch(`/api/recommendations/${itemId}/complete`, { method: 'POST' });
      setLearningPath((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, status: 'COMPLETED' } : item))
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" userName="Ananya Sharma" />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Your Personalized Learning Path</h1>
              <p className="text-xs text-slate-500 mt-1">
                Targeted capacity building drawing from iGOT Karmayogi & NSSTA TPAC recommended modules
              </p>
            </div>
            <div className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-200 font-mono font-bold">
              Simulated iGOT Ecosystem Integration
            </div>
          </div>

          {/* Stepper Roadmap List */}
          <div className="space-y-4 relative">
            {learningPath.map((item, idx) => {
              const isDone = item.status === 'COMPLETED';
              const isInProgress = item.status === 'IN_PROGRESS';
              return (
                <div
                  key={item.id || idx}
                  className={`bg-white p-6 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm ${
                    isDone
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : isInProgress
                      ? 'border-blue-400 ring-2 ring-blue-100'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        isDone
                          ? 'bg-emerald-600 text-white'
                          : isInProgress
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isDone ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono ${
                            item.priority === 'High'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {item.priority} Priority
                        </span>
                        <span className="text-[11px] font-bold text-blue-700">{item.provider}</span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900">{item.course_title}</h3>
                      <p className="text-xs text-slate-500">
                        Competency: <span className="font-semibold text-slate-700">{item.competency_name}</span> • Duration: {item.estimated_duration}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 flex-shrink-0">
                    {isDone ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300">
                        ✓ Completed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleComplete(item.id)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition-all flex items-center gap-1.5"
                      >
                        Start Learning <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center pt-4">
            <Link
              href="/dashboard/progress"
              className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Track Competency Score Progress <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
