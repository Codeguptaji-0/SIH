"use client";

import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';

interface CompetencyData {
  competency_name: string;
  score: number;
  domain: string;
}

interface CompetencyRadarProps {
  data: CompetencyData[];
}

export const CompetencyRadar: React.FC<CompetencyRadarProps> = ({ data }) => {
  const chartData = data.map((d) => ({
    subject: d.competency_name.length > 20 ? d.competency_name.substring(0, 18) + '...' : d.competency_name,
    fullSubject: d.competency_name,
    score: d.score,
    fullMark: 100
  }));

  const getBarColor = (score: number) => {
    if (score >= 80) return '#15803d'; // Green
    if (score >= 60) return '#ca8a04'; // Yellow
    return '#dc2626'; // Red
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Radar Chart */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Competency Radar (4 Domains)</h3>
          <p className="text-xs text-slate-500 mb-4">Multi-dimensional capability map vs expected baseline</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" fontSize={10} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#1d4ed8"
                fill="#3b82f6"
                fillOpacity={0.4}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar Chart Breakdown */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Competency Score Breakdown (%)</h3>
          <p className="text-xs text-slate-500 mb-4">Detailed proficiency percentages by subject area</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis dataKey="subject" type="category" tick={{ fontSize: 10, fill: '#334155' }} width={110} />
              <Tooltip formatter={(val: number) => [`${val}%`, 'Proficiency Score']} />
              <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={16}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
