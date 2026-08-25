"use client";

import React from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { ProgressChart } from '@/components/ProgressChart';
import { TrendingUp, Award, CheckCircle, ArrowUpRight } from 'lucide-react';

export default function ProgressTrackerPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" userName="Ananya Sharma" />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Competency Progress Tracker</h1>
            <p className="text-xs text-slate-500 mt-1">
              Historical proficiency score evolution before vs current training completion
            </p>
          </div>

          {/* Metric Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Initial Baseline</div>
                <div className="text-2xl font-extrabold text-slate-700 mt-1">42.0%</div>
                <div className="text-[10px] text-slate-400 mt-1">First Assessment Score</div>
              </div>
              <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Current Proficiency</div>
                <div className="text-2xl font-extrabold text-emerald-600 mt-1">71.0%</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-1">Post-Training Assessment</div>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Net Capacity Improvement</div>
                <div className="text-2xl font-extrabold text-blue-600 mt-1">+29.0 Points</div>
                <div className="text-[10px] text-blue-600 font-semibold mt-1 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> +69% Growth Rate
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Before vs After Chart */}
          <ProgressChart />

          {/* Detailed Improvement Logs */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Domain Improvement Ledger</h3>
            <div className="space-y-3">
              {[
                { domain: 'Statistical Methods & Inference', before: 42, after: 71, diff: '+29 pts' },
                { domain: 'Survey Design & Sampling Methods', before: 55, after: 78, diff: '+23 pts' },
                { domain: 'National Accounts & Price Statistics', before: 65, after: 82, diff: '+17 pts' },
                { domain: 'Data Analysis & Python/R', before: 88, after: 95, diff: '+7 pts' },
              ].map((row, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div className="font-bold text-slate-800">{row.domain}</div>
                  <div className="flex items-center space-x-6">
                    <span className="text-slate-400">Baseline: {row.before}%</span>
                    <span className="font-bold text-emerald-700">Current: {row.after}%</span>
                    <span className="font-extrabold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      {row.diff}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
