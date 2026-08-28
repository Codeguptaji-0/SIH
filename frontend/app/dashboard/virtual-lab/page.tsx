'use client';

import React, { useState } from 'react';
import Script from 'next/script';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { AlertTriangle, Play, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

declare global {
  interface Window {
    loadPyodide: any;
  }
}

const EXERCISES = [
  {
    id: 'ex-1',
    title: '1. Calculate Weighted Sample Mean',
    domain: 'Statistical Competencies',
    description: 'Compute Horvitz-Thompson weighted expenditure across National Sample Survey (NSS) strata.',
    code: `# Calculate Weighted Sample Mean for NSS Survey Strata
sample_data = [
    {"stratum": "Rural Stratum A", "mean_exp": 3200, "weight": 0.45},
    {"stratum": "Urban Stratum B", "mean_exp": 5400, "weight": 0.35},
    {"stratum": "Semi-Urban Stratum C", "mean_exp": 4100, "weight": 0.20}
]

weighted_sum = sum(d["mean_exp"] * d["weight"] for d in sample_data)
total_weight = sum(d["weight"] for d in sample_data)
weighted_mean = weighted_sum / total_weight

print("=== MoSPI National Sample Survey (NSS) Weight Calibration ===")
for d in sample_data:
    print(f"Stratum: {d['stratum']:<22} | Weight: {d['weight']:<4} | Mean Exp: Rs.{d['mean_exp']}")

print("-" * 60)
print(f"Total Population Weight  : {total_weight:.2f}")
print(f"National Estimated Mean  : Rs. {weighted_mean:.2f}")
`
  },
  {
    id: 'ex-2',
    title: '2. CPI Inflation Analysis & Tabulation',
    domain: 'Technical Competencies',
    description: 'Calculate year-over-year percentage inflation for MoSPI CPI commodity baskets.',
    code: `# Tabulate Official CPI Commodity Inflation Data
cpi_records = [
    {"item": "Cereals & Products", "weight": 9.67, "index_2025": 182.4, "index_2026": 191.2},
    {"item": "Pulses & Products", "weight": 2.38, "index_2025": 175.1, "index_2026": 184.8},
    {"item": "Milk & Products", "weight": 6.61, "index_2025": 168.0, "index_2026": 174.5},
    {"item": "Vegetables & Spices", "weight": 6.04, "index_2025": 195.2, "index_2026": 210.6}
]

print("=== MoSPI Consumer Price Index (CPI) YoY Inflation Report ===")
print(f"{'Commodity Sub-Basket':<22} | {'Weight':<6} | {'2025 Index':<10} | {'2026 Index':<10} | {'YoY Inflation'}")
print("=" * 68)

for r in cpi_records:
    inflation = ((r["index_2026"] - r["index_2025"]) / r["index_2025"]) * 100
    print(f"{r['item']:<22} | {r['weight']:<6} | {r['index_2025']:<10} | {r['index_2026']:<10} | {inflation:.2f}%")
`
  },
  {
    id: 'ex-3',
    title: '3. SQL-Style Data Filtering in Python',
    domain: 'Technical Competencies',
    description: 'Filter district survey logs to identify critical statistical competency gaps.',
    code: `# Filter Survey Districts with Critical Statistical Gaps
districts = [
    {"name": "District A (North)", "surveyed_blocks": 45, "gap_score": 72.5, "status": "Stable"},
    {"name": "District B (East)",  "surveyed_blocks": 28, "gap_score": 44.0, "status": "Critical Gap"},
    {"name": "District C (South)", "surveyed_blocks": 60, "gap_score": 85.0, "status": "Strong"},
    {"name": "District D (West)",  "surveyed_blocks": 15, "gap_score": 38.5, "status": "Critical Gap"}
]

# WHERE gap_score < 50.0 ORDER BY gap_score ASC
critical_districts = sorted([d for d in districts if d["gap_score"] < 50.0], key=lambda x: x["gap_score"])

print("=== MoSPI District Gap Identification Query ===")
print(f"Found {len(critical_districts)} districts requiring targeted capacity building:\n")
for d in critical_districts:
    print(f" [CRITICAL GAP] {d['name']:<20} | Score: {d['gap_score']}% | Blocks: {d['surveyed_blocks']}")
`
  }
];

export default function VirtualLabPage() {
  const { t } = useLanguage();
  const [selectedEx, setSelectedEx] = useState(EXERCISES[0]);
  const [code, setCode] = useState(EXERCISES[0].code);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [pyodide, setPyodide] = useState<any>(null);
  const [pyodideLoading, setPyodideLoading] = useState(true);

  /**
   * Why these two extra pieces of state exist.
   *
   * This page used to print a green "Pyodide Wasm Engine Ready" badge that was a
   * literal, and a hardcoded "Exit Code: 0". Worse, when Pyodide could not load
   * it ran a "simulated Python engine" that printed pre-written output for each
   * exercise - so on a machine with no network the lab looked like it had
   * executed code it never executed. Both are gone: the badge reports the real
   * engine state, and a run without an engine says so instead of inventing a
   * result.
   */
  const [engineError, setEngineError] = useState<string>(null);
  const [lastRunOk, setLastRunOk] = useState<boolean>(null);

  // Initialise the in-browser Python runtime (Pyodide, compiled to WebAssembly).
  const initPyodide = async () => {
    try {
      if (window.loadPyodide && !pyodide) {
        const py = await window.loadPyodide();
        setPyodide(py);
        setEngineError(null);
      } else if (!window.loadPyodide) {
        setEngineError('The Pyodide script loaded but did not expose loadPyodide().');
      }
    } catch (e: any) {
      setEngineError(e?.message || 'Pyodide failed to initialise.');
    } finally {
      setPyodideLoading(false);
    }
  };

  const handleSelectExercise = (ex: typeof EXERCISES[0]) => {
    setSelectedEx(ex);
    setCode(ex.code);
    setOutput('');
    setLastRunOk(null);
  };

  const runCode = async () => {
    // No engine means no result. Nothing is simulated in its place.
    if (!pyodide) {
      setLastRunOk(false);
      setOutput(
        'Nothing was executed: the in-browser Python runtime is not available.\n' +
          (engineError
            ? `Reason: ${engineError}\n`
            : 'The Pyodide runtime has not finished downloading yet.\n') +
          '\nNo output is simulated here. Anything printed without a running\n' +
          'interpreter would be a fabrication rather than a result.'
      );
      return;
    }

    setRunning(true);
    setLastRunOk(null);
    setOutput('Executing in the browser Python runtime…\n');

    try {
      // Capture stdout so print() lands in the console panel.
      pyodide.runPython(`
import sys
import io
sys.stdout = io.StringIO()
`);
      await pyodide.runPythonAsync(code);
      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      setOutput(stdout || '[Script completed with no console output.]');
      setLastRunOk(true);
    } catch (err: any) {
      setOutput(`Python error:\n${err?.message || err}`);
      setLastRunOk(false);
    } finally {
      setRunning(false);
    }
  };

  const engineLabel = pyodide
    ? 'Python runtime loaded'
    : pyodideLoading
    ? 'Loading Python runtime…'
    : 'Python runtime unavailable';
  const engineCls = pyodide
    ? 'border-strong-200 bg-strong-50 text-strong-700'
    : pyodideLoading
    ? 'border-rule bg-paper-sunken text-slate-500'
    : 'border-gap-200 bg-gap-50 text-gap-700';

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"
        onLoad={initPyodide}
        onError={() => {
          setPyodideLoading(false);
          setEngineError(
            'The Pyodide runtime could not be downloaded from the CDN. This page needs network access to execute Python in the browser.'
          );
        }}
      />

      <Navbar />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-8">
          <header className="flex flex-col justify-between gap-4 border-b-2 border-ink pb-6 md:flex-row md:items-end">
            <div className="min-w-0">
              <p className="eyebrow">Practical lab</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
                {t('virtualLabTitle')}
              </h1>
              <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
                {t('virtualLabSubtitle')}
              </p>
            </div>
            <div className="shrink-0">
              <span
                className={`inline-flex items-center border px-2.5 py-1 font-mono text-[10px] uppercase tracking-eyebrow ${engineCls}`}
              >
                {engineLabel}
              </span>
              <p className="mt-1.5 max-w-xs text-[11px] leading-relaxed text-slate-400">
                Python runs entirely in your browser through Pyodide. Nothing is sent to a server.
              </p>
            </div>
          </header>

          <div className="mt-8 space-y-8">

          {!pyodideLoading && !pyodide && (
            <div role="alert" className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-ink">Python runtime not available</h2>
                <p className="mt-1 break-words font-mono text-[11px] text-gap-700">
                  {engineError || 'loadPyodide() never became available on this page.'}
                </p>
                <p className="mt-1.5 text-xs text-gap-700">
                  The editor still works, but Run will not produce output. No sample output is shown
                  in place of a real run.
                </p>
              </div>
            </div>
          )}

          <section>
            <div className="border-b border-ink pb-2.5">
              <p className="eyebrow">Exercises</p>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                Each exercise loads a working script with its own illustrative figures. Edit the code
                freely; selecting another exercise replaces the editor contents.
              </p>
            </div>
            <ol className="m-0 mt-1 grid list-none grid-cols-1 gap-px bg-rule p-0 sm:grid-cols-3">
              {EXERCISES.map((ex, idx) => {
                const active = selectedEx.id === ex.id;
                return (
                  <li key={ex.id} className="bg-white">
                    <button
                      onClick={() => handleSelectExercise(ex)}
                      aria-current={active ? 'true' : undefined}
                      className={`h-full w-full border-l-2 px-4 py-3.5 text-left transition-colors ${
                        active
                          ? 'border-l-navy-600 bg-paper-sunken'
                          : 'border-l-transparent hover:border-l-rule-strong'
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] text-slate-400 tnum">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="eyebrow">{ex.domain}</span>
                      </div>
                      <h3
                        className={`mt-1.5 text-sm font-medium ${active ? 'text-ink' : 'text-slate-600'}`}
                      >
                        {ex.title.replace(/^\d+\.\s*/, '')}
                      </h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {ex.description}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Editor and console. The console reports what actually happened:
              no result line is printed until a run has been attempted. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="flex flex-col border border-ink bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-rule bg-paper-sunken px-4 py-2.5">
                <span className="font-mono text-[11px] text-slate-600">script.py</span>
                <button
                  onClick={runCode}
                  disabled={running}
                  className="inline-flex h-9 items-center gap-1.5 border border-navy-600 bg-navy-600 px-4 text-xs font-medium text-paper transition-colors hover:bg-navy-700 disabled:opacity-50"
                >
                  {running ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{running ? t('runningCode') : t('runCode')}</span>
                </button>
              </div>

              <label htmlFor="lab-editor" className="sr-only">
                Python source for the selected exercise
              </label>
              <textarea
                id="lab-editor"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-80 w-full resize-none bg-white p-4 font-mono text-xs leading-relaxed text-ink focus:outline-none focus:ring-1 focus:ring-inset focus:ring-navy-600"
                spellCheck={false}
              />
            </section>

            <section className="flex flex-col border border-ink bg-ink">
              <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-2.5">
                <span className="font-mono text-[11px] uppercase tracking-eyebrow text-slate-400">
                  {t('stdoutOutput')}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-slate-400">
                  {running
                    ? 'Running'
                    : lastRunOk === true
                    ? 'Completed'
                    : lastRunOk === false
                    ? 'Failed'
                    : 'Not run'}
                </span>
              </div>
              <pre className="h-80 w-full overflow-y-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-paper">
                {output || 'Run the script to see its output here.'}
              </pre>
            </section>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}
