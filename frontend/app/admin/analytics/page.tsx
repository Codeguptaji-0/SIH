"use client";

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { BarChart3, Users, Award, AlertTriangle, TrendingUp, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((res) => res.json())
      .then((data) => setAnalytics(data))
      .catch(() => {});
  }, []);

  const totalOfficials = analytics?.total_officials || 248;
  const completedCount = analytics?.assessments_completed || 182;
  const avgCompetency = analytics?.average_competency || 71.4;
  const criticalGaps = analytics?.critical_gaps_count || 37;

  const domainData = [
    { domain: 'Statistical Competencies', readiness: 64.2 },
    { domain: 'Technical Competencies', readiness: 78.5 },
    { domain: 'Digital Governance', readiness: 82.1 },
    { domain: 'Behavioural & Managerial', readiness: 85.0 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="ADMIN" userName="Rajesh Kumar" />

      <div className="flex flex-1">
        <Sidebar role="ADMIN" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Department Aggregate Analytics</h1>
              <p className="text-xs text-slate-500 mt-1">
                Organization-wide skill readiness and capacity building forecasting for MoSPI DIID
              </p>
            </div>
            <div className="bg-purple-100 border border-purple-300 text-purple-800 px-3 py-1 rounded-xl text-xs font-mono font-bold">
              DIID Executive Dashboard
            </div>
          </div>

          {/* Key Admin KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Total Officials</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalOfficials}</div>
                <div className="text-[10px] text-slate-400 mt-1">MoSPI Statistical Cadre</div>
              </div>
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Assessments Completed</div>
                <div className="text-2xl font-extrabold text-blue-600 mt-1">{completedCount}</div>
                <div className="text-[10px] text-blue-600 font-semibold mt-1">73.3% Participation Rate</div>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Average Competency</div>
                <div className="text-2xl font-extrabold text-emerald-600 mt-1">{avgCompetency}%</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-1">Above Target Minimum</div>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Critical Skill Gaps</div>
                <div className="text-2xl font-extrabold text-rose-600 mt-1">{criticalGaps}</div>
                <div className="text-[10px] text-rose-600 font-semibold mt-1">Targeted Training Assigned</div>
              </div>
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center font-bold">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Department Domain Readiness Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-1">MoSPI 4-Domain Readiness Distribution (%)</h3>
            <p className="text-xs text-slate-500 mb-4">Aggregated workforce capability across standard statistical & technical pillars</p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={domainData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="domain" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="readiness" name="Readiness Index (%)" fill="#1d4ed8" radius={[6, 6, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Organization Skill Gaps & Training Demand */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Top Department Skill Gaps</h3>
              <div className="space-y-2.5">
                {[
                  { name: 'Survey Design & Sampling Methods', gap: '42.0% Gap', count: '84 Officials' },
                  { name: 'Statistical Methods & Inference', gap: '48.5% Gap', count: '72 Officials' },
                  { name: 'National Accounts & Price Statistics', gap: '55.0% Gap', count: '58 Officials' },
                ].map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-xs">
                    <span className="font-bold text-slate-800">{g.name}</span>
                    <span className="font-bold text-rose-700 font-mono">{g.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Capacity Building Course Demand</h3>
              <div className="space-y-2.5">
                {[
                  { title: 'Advanced Survey Sampling & Weight Calibration', count: '84 Enrolled', provider: 'NSSTA TPAC' },
                  { title: 'Statistical Inference & Hypothesis Testing in Practice', count: '72 Enrolled', provider: 'iGOT Karmayogi' },
                  { title: 'National Accounts Statistics & Inflation Metrics', count: '58 Enrolled', provider: 'iGOT Karmayogi' },
                ].map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{d.title}</div>
                      <div className="text-[10px] text-blue-700 font-semibold">{d.provider}</div>
                    </div>
                    <span className="font-bold text-blue-800 font-mono">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
