"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { ApiError, apiJson } from '@/app/lib/api';

/**
 * Assessment Center.
 *
 * The old version advertised a fixed "10 Dynamic MCQs covering Survey Design,
 * Sampling, CPI and Python Data Analysis" and, when /api/materials returned
 * nothing (or failed - res.ok was never checked), printed "Default Demo Material
 * Available: Statistical Methods Training Material.pdf". Neither existed.
 *
 * Both panels are now driven by the API:
 *   GET /api/quizzes/active -> { quiz_id, total_questions, questions[],
 *                                approved_pool_size, message }
 *   GET /api/materials      -> [{ id, title, filename, department, page_count,
 *                                status, created_at }]
 *
 * The backend serves only trainer-approved questions, so when the approved pool
 * is empty the start button is withheld and the backend's own explanation shown.
 */

interface ActiveQuiz {
  quiz_id?: string;
  total_questions?: number;
  approved_pool_size?: number;
  message?: string;
}

interface Material {
  id?: string;
  title?: string;
  filename?: string;
  department?: string;
  page_count?: number;
  status?: string;
}

function describeError(e: unknown): string {
  if (e instanceof ApiError) return `${e.message} (HTTP ${e.status})`;
  return 'Cannot reach the SkillSetu backend. Start it with: uvicorn app.main:app --reload';
}

export default function AssessmentCenterPage() {
  const [quiz, setQuiz] = useState<ActiveQuiz>(null);
  const [quizError, setQuizError] = useState<string>(null);
  const [materials, setMaterials] = useState<Material[]>(null);
  const [materialsError, setMaterialsError] = useState<string>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setQuizError(null);
    setMaterialsError(null);

    const [quizResult, materialsResult] = await Promise.allSettled([
      apiJson<ActiveQuiz>('/api/quizzes/active'),
      apiJson<Material[]>('/api/materials'),
    ]);

    if (quizResult.status === 'fulfilled') {
      setQuiz(quizResult.value);
    } else {
      setQuiz(null);
      setQuizError(describeError(quizResult.reason));
    }

    if (materialsResult.status === 'fulfilled') {
      setMaterials(Array.isArray(materialsResult.value) ? materialsResult.value : []);
    } else {
      setMaterials(null);
      setMaterialsError(describeError(materialsResult.reason));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const questionCount = typeof quiz?.total_questions === 'number' ? quiz.total_questions : 0;
  const canStart = questionCount > 0 && !!quiz?.quiz_id;
  const materialList: Material[] = materials || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Assessment Center</h1>
              <p className="text-xs text-slate-500 mt-1">
                Assessments are assembled from trainer-approved questions generated from uploaded
                MoSPI training material
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {loading && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking for available assessments...
            </div>
          )}

          {!loading && quizError && (
            <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4" /> Could not check for an available assessment
              </div>
              <p className="text-xs text-rose-700 font-mono break-words">{quizError}</p>
            </div>
          )}

          {!loading && !quizError && canStart && (
            <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-6 rounded-3xl shadow-md border border-blue-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-blue-300 font-bold">
                  AVAILABLE ASSESSMENT
                </span>
                <h2 className="text-xl font-bold mt-1">Competency Assessment</h2>
                <p className="text-xs text-slate-300 mt-1">
                  {questionCount} trainer-approved question{questionCount === 1 ? '' : 's'} ready
                  {typeof quiz.approved_pool_size === 'number'
                    ? ` (approved pool: ${quiz.approved_pool_size})`
                    : ''}
                  .
                </p>
              </div>
              <Link
                href={`/dashboard/quiz/${encodeURIComponent(quiz.quiz_id)}`}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg text-xs flex items-center gap-2 transition-all flex-shrink-0"
              >
                Start Assessment <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {!loading && !quizError && !canStart && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <h2 className="text-sm font-bold text-slate-800">No assessment available yet</h2>
              <p className="text-xs text-slate-500 max-w-2xl">
                {quiz?.message ||
                  'The backend reported no trainer-approved questions, so there is nothing to attempt yet.'}
              </p>
              {typeof quiz?.approved_pool_size === 'number' ? (
                <p className="text-[11px] text-slate-400 font-mono">
                  Approved question pool size: {quiz.approved_pool_size}
                </p>
              ) : null}
            </div>
          )}

          {!loading && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Uploaded Training Material</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Questions generated from these documents enter the trainer review queue; only
                  approved ones reach the assessment above.
                </p>
              </div>

              {materialsError ? (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                    <AlertTriangle className="w-3.5 h-3.5" /> Could not load uploaded material
                  </div>
                  <p className="text-xs text-rose-700 font-mono break-words">{materialsError}</p>
                </div>
              ) : materialList.length === 0 ? (
                <p className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-200">
                  No training material has been uploaded yet. A trainer uploads documents from the
                  Document Upload screen.
                </p>
              ) : (
                <div className="space-y-3">
                  {materialList.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80 gap-3"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">
                            {m.title || m.filename || 'Untitled document'}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {m.department || 'Department not recorded'}
                            {typeof m.page_count === 'number' ? ` • ${m.page_count} pages` : ''}
                          </p>
                        </div>
                      </div>
                      {m.status ? (
                        <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                          {m.status}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
