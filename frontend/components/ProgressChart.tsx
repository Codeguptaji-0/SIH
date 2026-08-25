"use client";

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

export const ProgressChart: React.FC = () => {
  const comparisonData = [
    { name: 'Statistical Methods', baseline: 42, current: 71 },
    { name: 'Survey Sampling', baseline: 55, current: 78 },
    { name: 'National Accounts', baseline: 65, current: 82 },
    { name: 'Python / Data Analysis', baseline: 88, current: 95 },
    { name: 'SDMX Metadata', baseline: 75, current: 88 },
  ];

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Competency Growth (Before vs Current)</h3>
          <p className="text-xs text-slate-500">Measurable score improvement following personalized training completion</p>
        </div>
        <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          +29 Points Overall Gain
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={comparisonData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="baseline" name="Baseline Assessment" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
            <Bar dataKey="current" name="Post-Training Score" fill="#15803d" radius={[4, 4, 0, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
