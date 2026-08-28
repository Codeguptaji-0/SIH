"use client";

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { AlertTriangle, User } from 'lucide-react';
import { ApiError, apiJson } from '@/app/lib/api';

interface ProfileData {
  full_name?: string;
  designation?: string;
  department?: string;
  job_role?: string;
  current_assignment?: string;
  educational_qualification?: string;
  experience_years?: number;
  previous_trainings?: string[];
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Load the profile.
   *
   * Previously this was apiFetch(...).then(res => res.json()) with no res.ok
   * check, so a 401 or 404 body was stored as the profile and every field fell
   * back to a hardcoded officer record. apiJson throws ApiError on a non-2xx, so
   * a failure is shown as a failure.
   */
  useEffect(() => {
    let cancelled = false;

    apiJson<ProfileData>('/api/profile/me')
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError) {
          setStatus(e.status);
          setError(e.message);
        } else {
          setError('Cannot reach the SkillSetu backend. Start it with: uvicorn app.main:app --reload');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // The backend returns empty strings for fields that were never filled in, so
  // an empty string means "not set" and must not be replaced with an example.
  const text = (v?: string) => (v && v.trim() ? v.trim() : null);
  const fullName = text(profile?.full_name);
  const designation = text(profile?.designation);
  const department = text(profile?.department);
  const trainings = Array.isArray(profile?.previous_trainings)
    ? profile.previous_trainings.filter((tr) => typeof tr === 'string' && tr.trim())
    : [];
  // 404 = no profile row exists yet; anything else is a real error.
  const missing = status === 404;

  /** One field of the profile grid, or a "Not set" hint when it is empty. */
  const Field = ({ label, value }: { label: string; value: string | null }) => (
    <div className="bg-white px-4 py-3.5">
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1.5 text-sm ${value ? 'font-medium text-ink' : 'text-slate-400'}`}>
        {value || 'Not set'}
      </dd>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar userName={fullName || undefined} />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-8">
          <header className="border-b-2 border-ink pb-6">
            <p className="eyebrow">Officer record</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
              Competency profile
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
              The role definition these scores are measured against, and the four-domain framework
              the questions are drawn from.
            </p>
          </header>

          <div className="mt-8">

          {/* Profile summary: loading, failed, not-recorded, or real data. */}
          {loading ? (
            <div className="border border-rule bg-white p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 animate-pulse bg-paper-sunken" />
                <div className="space-y-2">
                  <div className="h-5 w-48 animate-pulse bg-paper-sunken" />
                  <div className="h-3 w-64 animate-pulse bg-paper-sunken" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 border-t border-rule pt-5 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse bg-paper-sunken" />
                ))}
              </div>
            </div>
          ) : error && !missing ? (
            <div
              role="alert"
              className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-medium text-ink">Profile could not be loaded</h2>
                <p className="mt-1 text-xs text-gap-700">{error}</p>
              </div>
            </div>
          ) : missing ? (
            <div className="border border-rule bg-white px-5 py-6">
              <h2 className="text-sm font-medium text-ink">No profile data recorded yet</h2>
              <p className="mt-1 max-w-lg text-xs leading-relaxed text-slate-500">
                Once a profile record exists, your role, assignment and training history appear here
                and are used to target recommendations.
              </p>
              {error && <p className="mt-2 font-mono text-[11px] text-slate-400">{error}</p>}
            </div>
          ) : (
          <div className="border border-rule bg-white">
            <div className="flex items-center gap-4 border-b border-ink px-5 py-5">
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center bg-ink font-display text-xl font-bold text-paper"
              >
                {fullName ? fullName.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <h2
                  className={`font-display text-lg font-semibold tracking-tight ${
                    fullName ? 'text-ink' : 'text-slate-400'
                  }`}
                >
                  {fullName || 'Name not set'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {designation || '—'} &nbsp;·&nbsp; {department || '—'}
                </p>
              </div>
            </div>

            <dl className="m-0 grid grid-cols-1 gap-px bg-rule sm:grid-cols-3">
              <Field label="Job role" value={text(profile?.job_role)} />
              <Field label="Current assignment" value={text(profile?.current_assignment)} />
              <Field label="Educational qualification" value={text(profile?.educational_qualification)} />
              <Field
                label="Experience"
                value={
                  typeof profile?.experience_years === 'number' && profile.experience_years > 0
                    ? `${profile.experience_years} years`
                    : null
                }
              />
              <div className="bg-white px-4 py-3.5 sm:col-span-2">
                <dt className="eyebrow">Previous trainings</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {trainings.length > 0 ? (
                    trainings.map((tr: string, idx: number) => (
                      <span
                        key={idx}
                        className="border border-rule bg-paper-sunken px-2 py-0.5 text-[11px] text-ink"
                      >
                        {tr}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">None recorded</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          )}
          </div>

          {/* The framework the questions and targets are drawn from. */}
          <section className="mt-9">
            <p className="eyebrow">Framework</p>
            <h2 className="mt-2 font-display text-lg font-semibold tracking-tight text-ink">
              MoSPI four-domain target framework
            </h2>
            <dl className="m-0 mt-4 grid grid-cols-1 border-t border-ink md:grid-cols-2 md:gap-x-10">
              {[
                {
                  domain: 'Statistical',
                  desc: 'Survey design, sampling, national accounts, price statistics, SDG indicators, metadata standards, data quality frameworks.',
                },
                {
                  domain: 'Technical',
                  desc: 'Python, R, SQL, Stata, SPSS, GIS, data visualization, machine learning, cloud computing, open data.',
                },
                {
                  domain: 'Digital governance',
                  desc: 'Cybersecurity, data privacy under the DPDP Act, digital signatures, government cloud, digital public infrastructure.',
                },
                {
                  domain: 'Behavioural and managerial',
                  desc: 'Leadership, communication, survey project management, ethics, decision making, change management.',
                },
              ].map((d) => (
                <div key={d.domain} className="border-b border-rule py-4">
                  <dt className="font-display text-sm font-semibold uppercase tracking-eyebrow text-ink">
                    {d.domain}
                  </dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">{d.desc}</dd>
                </div>
              ))}
            </dl>
          </section>
        </main>
      </div>
    </div>
  );
}
