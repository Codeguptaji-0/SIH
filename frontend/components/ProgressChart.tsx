'use client';

/*
 * Before-and-after comparison chart.
 *
 * This file used to hold five invented competencies and a "+29 Points Overall
 * Gain" badge, none of which came from the backend. Nothing imports the component,
 * so that fabricated panel was one import away from appearing in a demo. It now
 * takes its rows as a prop and renders an honest note when it has none.
 */

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

export interface ProgressRow {
  /** Competency name, as returned by the backend. */
  label: string;
  /** Score at the first assessment. */
  baseline: number;
  /** Most recent score. */
  current: number;
}

interface ProgressChartProps {
  rows?: ProgressRow[];
}

const INK_RULE = '#D9D7CE';
const INK_SLATE = '#5A6472';
const INK_MUTED = '#BFBCB0';
const INK_STRONG = '#1F6B4A';

export const ProgressChart: React.FC<ProgressChartProps> = ({ rows = [] }) => {
  const mean = (key: 'baseline' | 'current') =>
    rows.reduce((acc, r) => acc + r[key], 0) / rows.length;
  const gain = rows.length > 0 ? Math.round((mean('current') - mean('baseline')) * 10) / 10 : null;

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Score at first assessment against latest</p>
          <p className="mt-1.5 text-xs text-slate-500">
            Only competencies assessed at least twice appear here
          </p>
        </div>
        {gain !== null && (
          <p className="font-mono text-xs text-slate-500 tnum">
            Mean change {gain > 0 ? `+${gain}` : gain}
          </p>
        )}
      </figcaption>

      {rows.length === 0 ? (
        <p className="border-l-2 border-rule-strong bg-paper-sunken px-4 py-3 text-xs leading-relaxed text-slate-500">
          No repeat assessment recorded yet. This comparison appears once a competency has been
          assessed a second time.
        </p>
      ) : (
        <div className="border border-rule bg-white p-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={INK_RULE} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: INK_SLATE }} stroke={INK_RULE} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: INK_SLATE }} stroke={INK_RULE} />
                <Tooltip
                  contentStyle={{ border: `1px solid ${INK_RULE}`, borderRadius: 2, boxShadow: 'none', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="baseline" name="First assessment" fill={INK_MUTED} barSize={18} isAnimationActive={false} />
                <Bar dataKey="current" name="Latest score" fill={INK_STRONG} barSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </figure>
  );
};
