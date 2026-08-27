"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { Award, ArrowRight, BookOpen, Clock, FileText, CheckCircle } from 'lucide-react';
import { apiFetch } from '@/app/lib/api';

export default function AssessmentCenterPage() {
  const [materials, setMaterials] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/api/materials')
      .then((res) => res.json())
      .then((data) => setMaterials(data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" userName="Ananya Sharma" />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Assessment Center</h1>
            <p className="text-xs text-slate-500 mt-1">Select an AI-generated assessment based on official MoSPI training materials</p>
          </div>

          <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-6 rounded-3xl shadow-md border border-blue-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-blue-300 font-bold">RECOMMENDED FOR YOUR ROLE</span>
              <h2 className="text-xl font-bold mt-1">MoSPI 4-Domain Comprehensive Adaptive Assessment</h2>
              <p className="text-xs text-slate-300 mt-1">10 Dynamic MCQs covering Survey Design, Sampling, CPI, and Python Data Analysis.</p>
            </div>
            <Link
              href="/dashboard/quiz/active-quiz-session-001"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg text-xs flex items-center gap-2 transition-all flex-shrink-0"
            >
              Start Adaptive Quiz <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Material Assessments */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Uploaded Document Assessments</h3>

            <div className="space-y-3">
              {materials.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500">
                  Default Demo Material Available: Statistical Methods Training Material.pdf
                </div>
              ) : (
                materials.map((m) => (
                  <div key={m.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80 gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{m.title}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{m.department} • {m.page_count} Pages</p>
                      </div>
                    </div>
                    <Link
                      href="/dashboard/quiz/active-quiz-session-001"
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      Take Quiz <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
