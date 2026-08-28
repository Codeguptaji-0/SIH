'use client';

/*
 * Competency reporting for the officer dashboard.
 *
 * The radar chart is gone. A four-spoke polygon is decorative here - it cannot be
 * read to a number, and it was the least informative element on the busiest page.
 * In its place: a ruled tabulation of every competency, worst first, which is what
 * the officer actually needs to act on, beside one honest chart of mean score by
 * domain (information the table does not carry).
 *
 * The component name and props are unchanged so existing pages keep working.
 */

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, CartesianGrid } from 'recharts';

interface CompetencyData {
  competency_name: string;
  score: number;
  domain: string;
}

interface CompetencyRadarProps {
  data: CompetencyData[];
}

/* Band inks, matching the tokens in tailwind.config.js. */
const INK_STRONG = '#1F6B4A';
const INK_WATCH = '#A9741B';
const INK_GAP = '#9C3B2E';
const INK_RULE = '#D9D7CE';
const INK_SLATE = '#5A6472';

function bandOf(score: number) {
  if (score >= 80) return { label: 'Strong', hex: INK_STRONG, cls: 'text-strong-700', bar: 'bg-strong-600' };
  if (score >= 60) return { label: 'Watch', hex: INK_WATCH, cls: 'text-watch-700', bar: 'bg-watch-500' };
  return { label: 'Gap', hex: INK_GAP, cls: 'text-gap-700', bar: 'bg-gap-600' };
}

export const CompetencyRadar: React.FC<CompetencyRadarProps> = ({ data }) => {
  /* Worst first: the row an officer has to do something about goes at the top. */
  const rows = React.useMemo(
    () => [...data].sort((a, b) => a.score - b.score),
    [data]
  );

  /* Mean score per domain - the one thing the table above does not report. */
  const domains = React.useMemo(() => {
    const acc = new Map<string, { total: number; n: number }>();
    data.forEach((d) => {
      const key = d.domain?.trim() || 'Unspecified';
      const cur = acc.get(key) ?? { total: 0, n: 0 };
      acc.set(key, { total: cur.total + d.score, n: cur.n + 1 });
    });
    return Array.from(acc, ([domain, v]) => ({
      domain,
      score: Math.round((v.total / v.n) * 10) / 10,
    })).sort((a, b) => a.score - b.score);
  }, [data]);

  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Tabulation. Worst-first, with the score drawn as well as printed. */}
      <figure className="m-0 lg:col-span-7">
        <figcaption className="mb-3">
          <p className="eyebrow">Competency scores</p>
          <p className="mt-1.5 text-xs text-slate-500">
            Every assessed competency, lowest score first
          </p>
        </figcaption>
        <div className="overflow-x-auto border border-rule bg-white">
          <table className="table-release min-w-[30rem]">
            <thead>
              <tr>
                <th scope="col">Competency</th>
                <th scope="col" className="num">Score</th>
                <th scope="col" className="hidden sm:table-cell">Level</th>
                <th scope="col">Band</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const band = bandOf(r.score);
                return (
                  <tr key={r.competency_name}>
                    <th scope="row" className="text-left align-baseline font-normal">
                      <span className="block text-ink">{r.competency_name}</span>
                      <span className="eyebrow mt-1 block">{r.domain || 'Unspecified'}</span>
                    </th>
                    <td className={`num font-medium ${band.cls}`}>{r.score}</td>
                    <td className="hidden sm:table-cell">
                      <div className="h-[6px] w-[88px] bg-paper-sunken" aria-hidden="true">
                        <div
                          className={`h-full ${band.bar}`}
                          style={{ width: `${Math.max(0, Math.min(100, r.score))}%` }}
                        />
                      </div>
                    </td>
                    <td className={`whitespace-nowrap ${band.cls}`}>{band.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Bands: 80 and above is strong, 60 to 79 needs improvement, below 60 is a critical gap.
        </p>
      </figure>

      {/* Mean by domain. Flat bars, hairline gridlines, no rounded ends. */}
      <figure className="m-0 lg:col-span-5">
        <figcaption className="mb-3">
          <p className="eyebrow">Mean score by domain</p>
          <p className="mt-1.5 text-xs text-slate-500">
            Averaged across the competencies assessed in each domain
          </p>
        </figcaption>
        <div className="border border-rule bg-white p-4">
          <div style={{ height: Math.max(160, domains.length * 46) }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={domains}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} stroke={INK_RULE} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: INK_SLATE }}
                  stroke={INK_RULE}
                  tickLine={false}
                />
                <YAxis
                  dataKey="domain"
                  type="category"
                  width={104}
                  tick={{ fontSize: 10, fill: INK_SLATE }}
                  stroke={INK_RULE}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: number) => [`${val}`, 'Mean score']}
                  contentStyle={{
                    border: `1px solid ${INK_RULE}`,
                    borderRadius: 2,
                    boxShadow: 'none',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="score" barSize={14} isAnimationActive={false}>
                  {domains.map((d) => (
                    <Cell key={d.domain} fill={bandOf(d.score).hex} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </figure>

    </div>
  );
};
