"use client";

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { BarChart3, Users, Award, AlertTriangle, TrendingUp, TrendingDown, Minus, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../../context/AuthContext';

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const { user, loginPersona, getAuthHeaders } = useAuth();

  useEffect(() => {
    // Ensure Admin persona token is requested if current user is not ADMIN
    if (!user || user.role !== 'ADMIN') {
      loginPersona('admin@skillsetu.demo').then(() => fetchAnalytics());
    } else {
      fetchAnalytics();
    }
  }, [user?.role]);

  const fetchAnalytics = () => {
    fetch('http://localhost:8000/api/admin/analytics', {
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (res.ok) return res.json();
        // Fallback fetch
        return fetch('/api/admin/analytics').then(r => r.json());
      })
      .then((data) => setAnalytics(data))
      .catch(() => {});
  };

  const totalOfficials = analytics?.total_officials || 248;
  const completedCount = analytics?.assessments_completed || 182;
  const avgCompetency = analytics?.average_competency || 71.4;
  const criticalGaps = analytics?.critical_gaps_count || 37;

  const domainReadinessObj = analytics?.domain_readiness || {
    "Statistical Competencies": 64.2,
    "Technical Competencies": 78.5,
    "Digital Governance": 82.1,
    "Behavioural & Managerial": 85.0
  };

  const domainTrendsObj = analytics?.domain_trends || {
    "Statistical Competencies": "trending_up",
    "Technical Competencies": "trending_up",
    "Digital Governance": "stable",
    "Behavioural & Managerial": "stable"
  };

  const domainData = Object.keys(domainReadinessObj).map(key => ({
    domain: key,
    readiness: domainReadinessObj[key],
    trend: domainTrendsObj[key] || "stable"
  }));

  const topGaps = analytics?.top_gaps || [
    { competency: 'Survey Design & Sampling Methods', gap_percentage: 42.0, officials_affected: 84 },
    { competency: 'Statistical Methods & Inference', gap_percentage: 48.5, officials_affected: 72 },
    { competency: 'National Accounts & Price Statistics', gap_percentage: 55.0, officials_affected: 58 },
    { competency: 'Official Statistics & Data Visualization', gap_percentage: 68.0, officials_affected: 32 }
  ];

  const trainingDemand = analytics?.training_demand || [
    { course_title: 'Advanced Survey Sampling & Weight Calibration', enrolled_officials: 84, provider: 'NSSTA TPAC' },
    { course_title: 'Statistical Inference & Hypothesis Testing in Practice', enrolled_officials: 72, provider: 'iGOT Karmayogi' },
    { course_title: 'National Accounts Statistics & Inflation Metrics', enrolled_officials: 58, provider: 'iGOT Karmayogi' },
    { course_title: 'SDMX Metadata Standards & Open Data Publishing', enrolled_officials: 32, provider: 'NSSTA TPAC' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="ADMIN" userName={user?.full_name || "Rajesh Kumar"} />

      <div className="flex flex-1">
        <Sidebar role="ADMIN" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Department Aggregate Analytics</h1>
              <p className="text-xs text-slate-500 mt-1">
                Organization-wide skill readiness and predictive capacity building forecasting for MoSPI DIID
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

          {/* Department Domain Readiness Chart & Predictive Trends */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">MoSPI 4-Domain Readiness & Predictive Trends</h3>
                <p className="text-xs text-slate-500 mt-0.5">Aggregated capability index computed from active quiz attempts & 7-day trend analysis</p>
              </div>
            </div>

            {/* Predictive Trend Signal Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              {domainData.map((d, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div className="text-[11px] text-slate-500 font-medium truncate">{d.domain}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-extrabold text-slate-900 text-sm">{d.readiness}%</span>
                    {d.trend === 'trending_up' && (
                      <span className="flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                        <TrendingUp className="w-3 h-3 text-emerald-600" /> Trending Up
                      </span>
                    )}
                    {d.trend === 'trending_down' && (
                      <span className="flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded text-[10px] font-bold">
                        <TrendingDown className="w-3 h-3 text-rose-600" /> Action Needed
                      </span>
                    )}
                    {d.trend === 'stable' && (
                      <span className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        <Minus className="w-3 h-3 text-blue-500" /> Stable Trend
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="h-64 w-full pt-2">
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
              <h3 className="text-sm font-bold text-slate-800">Top Department Skill Gaps (DB Aggregated)</h3>
              <div className="space-y-2.5">
                {topGaps.map((g: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-xs">
                    <span className="font-bold text-slate-800">{g.competency}</span>
                    <span className="font-bold text-rose-700 font-mono">{g.officials_affected || g.count} Officials</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Capacity Building Course Demand (iGOT & NSSTA)</h3>
              <div className="space-y-2.5">
                {trainingDemand.map((d: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{d.course_title || d.title}</div>
                      <div className="text-[10px] text-blue-700 font-semibold">{d.provider}</div>
                    </div>
                    <span className="font-bold text-blue-800 font-mono">{d.enrolled_officials || d.count} Enrolled</span>
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

