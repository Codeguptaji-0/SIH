"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { CompetencyRadar } from '@/components/CompetencyRadar';
import { VirtualAssistantWidget } from '@/components/VirtualAssistantWidget';
import { Award, AlertTriangle, CheckCircle, ArrowRight, BookOpen, Clock, RefreshCw } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';

export default function OfficialDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [competencies, setCompetencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    fetch('/api/profile/me')
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
      })
      .catch(() => {});

    fetch('/api/competency/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.competencies && data.competencies.length > 0) {
          setCompetencies(data.competencies);
        } else {
          // Default baseline competency data
          setCompetencies([
            { competency_name: 'Statistical Methods & Inference', score: 42.0, domain: 'Statistical Competencies' },
            { competency_name: 'Survey Design & Sampling Methods', score: 55.0, domain: 'Statistical Competencies' },
            { competency_name: 'National Accounts & Price Statistics', score: 65.0, domain: 'Statistical Competencies' },
            { competency_name: 'Data Analysis & Python/R', score: 88.0, domain: 'Technical Competencies' },
            { competency_name: 'Official Statistics & Visualization', score: 75.0, domain: 'Technical Competencies' },
            { competency_name: 'Data Privacy & Cybersecurity', score: 90.0, domain: 'Digital Governance' },
          ]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const strongCount = competencies.filter((c) => c.score >= 80).length;
  const improvementCount = competencies.filter((c) => c.score >= 60 && c.score < 80).length;
  const gapCount = competencies.filter((c) => c.score < 60).length;
  const overallAvg = competencies.length > 0 ? roundVal(competencies.reduce((acc, curr) => acc + curr.score, 0) / competencies.length) : 71.4;

  function roundVal(val: number) {
    return Math.round(val * 10) / 10;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" userName={profile?.full_name || 'Ananya Sharma'} />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-3xl shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-blue-400 font-bold uppercase tracking-wider mb-1">
                {t('overviewHeader')}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {t('welcomeUser')}, {profile?.full_name || 'Ananya Sharma'}
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                {t('jobRole')}: <span className="font-semibold text-white">{profile?.designation || 'Statistical Officer'}</span> • Department: <span className="font-semibold text-white">{profile?.department || 'MoSPI DIID'}</span>
              </p>
            </div>
            <Link
              href="/dashboard/quiz/active-quiz-session-001"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-600/30 text-xs flex items-center gap-2 transition-all"
            >
              {t('startAssessment')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Overall Score</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{overallAvg}%</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-1">Target: 80% Baseline</div>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Strong Areas</div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-1">{strongCount}</div>
                <div className="text-[10px] text-slate-400 mt-1">Score ≥ 80%</div>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Needs Improvement</div>
                <div className="text-2xl font-extrabold text-amber-600 mt-1">{improvementCount}</div>
                <div className="text-[10px] text-slate-400 mt-1">Score 60% – 79%</div>
              </div>
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold">
                <RefreshCw className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Critical Gaps</div>
                <div className="text-2xl font-extrabold text-rose-600 mt-1">{gapCount}</div>
                <div className="text-[10px] text-rose-600 font-semibold mt-1">High Priority Training Needed</div>
              </div>
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center font-bold">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Competency Radar & Charts */}
          <CompetencyRadar data={competencies} />

          {/* Active Learning Path Preview */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Your Recommended Learning Pathway</h3>
                <p className="text-xs text-slate-500">Prioritized courses from iGOT Karmayogi & NSSTA TPAC catalogs</p>
              </div>
              <Link href="/dashboard/learning-path" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                View Full Path <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {[
                { title: 'Advanced Survey Sampling & Weight Calibration', provider: 'NSSTA TPAC', tag: 'High Priority (Gap)', duration: '4 hours', status: 'IN_PROGRESS' },
                { title: 'Statistical Inference & Hypothesis Testing in Practice', provider: 'iGOT Karmayogi', tag: 'High Priority (Gap)', duration: '3 hours', status: 'ASSIGNED' },
                { title: 'National Accounts Statistics & Inflation Metrics', provider: 'iGOT Karmayogi', tag: 'Medium Priority', duration: '2.5 hours', status: 'ASSIGNED' },
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{item.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span className="font-medium text-slate-600">{item.provider}</span> •
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.duration}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    item.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <VirtualAssistantWidget />
    </div>
  );
}
