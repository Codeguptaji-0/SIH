'use client';

/*
 * SkillSetu landing page.
 *
 * Design direction: a release from a statistics office. Paper ground, hairline
 * rules, one navy accent, figures set in tabular numerals. The hero is not a
 * headline over a gradient - it is Table 1, a real competency tabulation, because
 * that table IS the product's output and showing it explains SkillSetu faster than
 * any sentence about it. Everything else on the page is set quietly around it.
 *
 * Two deliberate corrections to the previous version:
 *
 *   - The old "Get Started" and "Launch Demo" buttons both linked straight to
 *     /dashboard. Signed out, that produced a dashboard shell with three red
 *     "Missing Authorization header" errors where the officer's scores belong.
 *     Every call to action here goes to /login.
 *   - Table 1 is labelled as illustrative in the caption AND in a footnote. It
 *     shows the shape of the output, and it must never be mistaken for a real
 *     officer's record.
 */

import React from 'react';
import Link from 'next/link';

/** Competency bands, keyed by how far the score sits from the role's target. */
const BAND = {
  meets: { label: 'Meets target', cls: 'text-strong-700', bar: 'bg-strong-600' },
  below: { label: 'Below target', cls: 'text-watch-700', bar: 'bg-watch-500' },
  gap: { label: 'Critical gap', cls: 'text-gap-700', bar: 'bg-gap-600' },
} as const;

type BandKey = keyof typeof BAND;

function bandFor(delta: number): BandKey {
  if (delta >= 0) return 'meets';
  if (delta > -10) return 'below';
  return 'gap';
}

/**
 * Illustrative rows for Table 1.
 *
 * Scores and targets are made up to show the format; the competency names and the
 * four domains are the real ones seeded in database/seed.sql. Two rows are chosen
 * to make the point that a raw score means nothing on its own: 74 is below target
 * while 61 is below by more, because the targets differ by role.
 */
const TABLE_1: { competency: string; domain: string; score: number; target: number }[] = [
  { competency: 'Official statistics & data visualization', domain: 'Technical', score: 88, target: 70 },
  { competency: 'Survey design & sampling methods', domain: 'Statistical', score: 82, target: 75 },
  { competency: 'Statistical methods & inference', domain: 'Statistical', score: 74, target: 75 },
  { competency: 'National accounts & price statistics', domain: 'Statistical', score: 61, target: 70 },
  { competency: 'Data privacy & cybersecurity', domain: 'Digital governance', score: 55, target: 65 },
  { competency: 'Data analysis & Python/R', domain: 'Technical', score: 48, target: 70 },
];

/**
 * The method, in the order it actually happens. Numbered because this genuinely
 * is a sequence - each stage consumes the previous one's output.
 */
const STAGES: { n: string; head: string; body: string; who: string }[] = [
  {
    n: '1',
    head: 'Role is matched to a target profile',
    body: 'An officer is mapped to their job role, and that role carries a required proficiency level for each competency it touches. Nothing is scored against a national average.',
    who: 'On sign-in',
  },
  {
    n: '2',
    head: 'Assessment adapts to the answers',
    body: 'Questions are drawn per competency and the difficulty moves with performance, so a strong area is confirmed in a few items and a weak one is examined properly instead of padded out.',
    who: 'Officer',
  },
  {
    n: '3',
    head: 'Scores are tabulated against the target',
    body: 'Each competency returns a score, the shortfall against the role target, and a band. The gap, not the score, is what the rest of the system acts on.',
    who: 'Automatic',
  },
  {
    n: '4',
    head: 'A learning path is issued for the shortfalls only',
    body: 'Gaps are ordered by severity and matched to iGOT Karmayogi and NSSTA TPAC courses. Competencies already at target produce no coursework.',
    who: 'Officer, trainer',
  },
];

/** The four domains the seeded competency framework is organised under. */
const DOMAINS: { name: string; note: string }[] = [
  { name: 'Statistical', note: 'Sampling, inference, national accounts, price and index statistics.' },
  { name: 'Technical', note: 'Data analysis in Python and R, visualization, dissemination of official statistics.' },
  { name: 'Digital governance', note: 'Data privacy, cybersecurity, e-governance platforms and standards.' },
  { name: 'Managerial', note: 'Coordination across divisions, quality assurance, supervision of field work.' },
];

/** Ruled section label plus heading, the way a release numbers its sections. */
function SectionHead({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-7">
      <p className="eyebrow">{label}</p>
      <h2 className="mt-2 max-w-2xl font-display text-2xl font-semibold tracking-tightest text-ink md:text-3xl">
        {title}
      </h2>
    </div>
  );
}

const SHELL = 'mx-auto w-full max-w-6xl px-5 md:px-8';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-paper">
      {/* Departmental strip. Small, ruled, and the only place the ministry is named. */}
      <div className="border-b border-rule">
        <div className={`${SHELL} flex h-10 items-center justify-between gap-4`}>
          <p className="eyebrow truncate">
            Ministry of Statistics and Programme Implementation
          </p>
          <Link
            href="/login"
            className="eyebrow shrink-0 text-navy-600 underline decoration-navy-200 underline-offset-4 hover:decoration-navy-600"
          >
            Sign in
          </Link>
        </div>
      </div>

      {/* Masthead. */}
      <header className="border-b-2 border-ink">
        <div className={`${SHELL} flex flex-col gap-4 py-7 md:flex-row md:items-end md:justify-between md:py-9`}>
          <div>
            <h1 className="font-display text-4xl font-extrabold uppercase tracking-tightest text-ink md:text-5xl">
              SkillSetu
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-500">
              Competency assessment and training routing for the Indian Statistical System
            </p>
          </div>
          <dl className="flex gap-6 text-xs md:justify-end">
            <div>
              <dt className="eyebrow">Problem statement</dt>
              <dd className="mt-1 font-mono text-sm text-ink tnum">SIH26101</dd>
            </div>
            <div>
              <dt className="eyebrow">Build</dt>
              <dd className="mt-1 font-mono text-sm text-ink">Prototype</dd>
            </div>
          </dl>
        </div>
      </header>

      {/* Section 1 - summary, set against Table 1. */}
      <section className="border-b border-rule">
        <div className={`${SHELL} grid gap-10 py-10 md:grid-cols-12 md:gap-14 md:py-14`}>
          <div className="md:col-span-5">
            <p className="eyebrow">Summary</p>
            <p className="mt-3 font-display text-[1.75rem] font-semibold leading-[1.14] tracking-tightest text-ink md:text-[2.125rem]">
              An officer gets a measured profile, not a course catalogue.
            </p>
            <div className="mt-5 space-y-4 text-[0.9375rem] leading-relaxed text-slate-600">
              <p>
                SkillSetu assesses a statistical officer against the competencies their own
                role requires, reports the shortfall for each one, and issues coursework only
                where a shortfall exists. Training that an officer already does not need is
                the thing this removes.
              </p>
              <p>
                Gaps are matched to iGOT Karmayogi and NSSTA TPAC offerings. Trainers upload
                their own material, review every generated question before it reaches an
                officer, and see where their cohort actually stands.
              </p>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
              >
                Sign in to begin
              </Link>
              <a
                href="#method"
                className="inline-flex h-11 items-center border border-rule-strong bg-white px-5 text-sm font-medium text-ink transition-colors hover:border-ink"
              >
                How it works
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Three sign-in roles are available: officer, trainer, and division administrator.
            </p>
          </div>

          {/* Table 1 - the hero. This tabulation is what the product produces. */}
          <figure className="m-0 md:col-span-7">
            <figcaption className="mb-3">
              <p className="eyebrow">Table 1 &nbsp;·&nbsp; Illustrative</p>
              <p className="mt-1.5 text-sm font-medium text-ink">
                Competency profile of one officer, scored against the targets set for their role
              </p>
            </figcaption>

            <div className="overflow-x-auto border border-rule bg-white">
              <table className="table-release min-w-[34rem]">
                <thead>
                  <tr>
                    <th scope="col">Competency</th>
                    <th scope="col" className="num">Score</th>
                    <th scope="col" className="num">Target</th>
                    <th scope="col" className="num">Diff</th>
                    <th scope="col" className="hidden sm:table-cell">Deviation</th>
                    <th scope="col">Band</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLE_1.map((row, i) => {
                    const delta = row.score - row.target;
                    const band = BAND[bandFor(delta)];
                    const pct = Math.min(Math.abs(delta) / 25, 1) * 50;
                    return (
                      <tr
                        key={row.competency}
                        className="animate-row-in"
                        style={{ animationDelay: `${120 + i * 70}ms` }}
                      >
                        <th scope="row" className="px-3 py-2.5 text-left align-baseline font-normal">
                          <span className="block text-ink">{row.competency}</span>
                          <span className="eyebrow mt-1 block">{row.domain}</span>
                        </th>
                        <td className="num font-medium text-ink">{row.score}</td>
                        <td className="num text-slate-500">{row.target}</td>
                        <td className={`num font-medium ${band.cls}`}>
                          {delta > 0 ? `+${delta}` : delta}
                        </td>
                        <td className="hidden sm:table-cell">
                          <div className="relative h-3 w-[88px]" aria-hidden="true">
                            <div className="absolute inset-y-0 left-1/2 w-px bg-rule-strong" />
                            <div
                              className={`absolute top-1/2 h-[6px] -translate-y-1/2 ${band.bar}`}
                              style={
                                delta >= 0
                                  ? { left: '50%', width: `${pct}%` }
                                  : { right: '50%', width: `${pct}%` }
                              }
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

            <div className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-400">
              <p>
                Figures are illustrative and shown to explain the output format. A real profile
                is computed from the officer&apos;s own answers against their role&apos;s targets.
              </p>
              <p>
                Diff is score minus target. Deviation bars are drawn to a fixed scale of plus or
                minus 25 points. A shortfall of 10 points or more is reported as a critical gap.
              </p>
            </div>
          </figure>

        </div>
      </section>

      {/* Section 2 - the method, as a ruled sequence rather than feature cards. */}
      <section id="method" className="scroll-mt-4 border-b border-rule">
        <div className={`${SHELL} py-10 md:py-14`}>
          <SectionHead label="Section 2 · Method" title="Four stages, in the order they happen" />
          <ol className="m-0 list-none border-t border-ink p-0">
            {STAGES.map((s) => (
              <li key={s.n} className="grid gap-x-6 gap-y-2 border-b border-rule py-5 md:grid-cols-12">
                <div className="flex items-baseline gap-3 md:col-span-4">
                  <span className="font-mono text-xs text-slate-400 tnum">{s.n}</span>
                  <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                    {s.head}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-600 md:col-span-6">{s.body}</p>
                <p className="eyebrow md:col-span-2 md:text-right">{s.who}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Section 3 - the framework being measured against. */}
      <section className="border-b border-rule bg-paper-sunken">
        <div className={`${SHELL} py-10 md:py-14`}>
          <SectionHead label="Section 3 · Coverage" title="What is measured" />
          <p className="-mt-3 mb-8 max-w-2xl text-sm leading-relaxed text-slate-600">
            The seeded framework carries 24 competencies across four domains, each with reviewed
            questions at three difficulty bands. Job roles draw on different subsets, which is why
            two officers can hold the same score and receive different coursework.
          </p>
          <dl className="m-0 grid gap-x-8 gap-y-6 border-t border-ink pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {DOMAINS.map((d) => (
              <div key={d.name}>
                <dt className="font-display text-sm font-semibold uppercase tracking-eyebrow text-ink">
                  {d.name}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-600">{d.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Section 4 - notes. The AI disclaimer lives here, stated plainly. */}
      <section>
        <div className={`${SHELL} py-10 md:py-14`}>
          <SectionHead label="Section 4 · Notes" title="How the automated parts are handled" />
          <div className="grid gap-x-12 gap-y-8 border-t border-ink pt-6 md:grid-cols-2">
            <div className="space-y-3 text-sm leading-relaxed text-slate-600">
              <p>
                <span className="font-medium text-ink">Where a language model is used.</span>{' '}
                Question drafts, answer explanations, and the learning assistant are generated by a
                language model from material a trainer has uploaded. Nothing generated reaches an
                officer until a trainer has approved it.
              </p>
              <p>
                <span className="font-medium text-ink">Where one is not.</span> Scores, shortfalls
                against target, bands, and the ordering of a learning path are arithmetic over
                recorded answers. They are reproducible and do not depend on a model.
              </p>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-slate-600">
              <p>
                <span className="font-medium text-ink">Course sources.</span> Recommendations point
                to iGOT Karmayogi modules and NSSTA TPAC programmes. SkillSetu selects among them;
                it does not host or replace them.
              </p>
              <p>
                <span className="font-medium text-ink">Status.</span> This is a prototype built for
                Smart India Hackathon 2026 under problem statement SIH26101. It is not a live
                system of record, and no real officer data is held in it.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-rule pt-6">
            <Link
              href="/login"
              className="inline-flex h-11 items-center border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
            >
              Sign in
            </Link>
            <p className="text-xs text-slate-400">
              Officers, trainers, and administrators use the same entry point.
            </p>
          </div>
        </div>
      </section>

      {/* Colophon. */}
      <footer className="border-t-2 border-ink">
        <div className={`${SHELL} flex flex-col gap-2 py-6 md:flex-row md:items-center md:justify-between`}>
          <p className="eyebrow">
            SkillSetu &nbsp;·&nbsp; Prototype &nbsp;·&nbsp; SIH26101
          </p>
          <p className="eyebrow">
            Ministry of Statistics and Programme Implementation &nbsp;·&nbsp; NSSTA
          </p>
        </div>
      </footer>
    </main>
  );
}
