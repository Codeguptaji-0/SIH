"use client";

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { UserCheck, Shield, CheckCircle2, Award, Briefcase, Building, AlertTriangle, User } from 'lucide-react';
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
    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
      <div className="text-slate-400 font-medium">{label}</div>
      <div className={`mt-1 ${value ? 'font-bold text-slate-800' : 'text-slate-400 italic'}`}>
        {value || 'Not set'}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" userName={fullName || undefined} />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Official Competency Profile</h1>
            <p className="text-xs text-slate-500 mt-1">Role definition and MoSPI 4-domain competency framework targets</p>
          </div>

          {/* Profile Summary Card: loading, failed, not-recorded, or real data. */}
          {loading ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-5 w-48 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ) : error && !missing ? (
            <div role="alert" className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Profile could not be loaded</h2>
                <p className="text-xs text-rose-700 mt-1">{error}</p>
              </div>
            </div>
          ) : missing ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
              <User className="w-6 h-6 text-slate-400 mx-auto" />
              <h2 className="text-sm font-bold text-slate-900 mt-2">No profile data recorded yet</h2>
              <p className="text-xs text-slate-500 mt-1">
                Once a profile record exists, your role, assignment and training history appear here and
                are used to target recommendations.
              </p>
              {error && <p className="text-[11px] text-slate-400 mt-2 font-mono">{error}</p>}
            </div>
          ) : (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white font-bold text-2xl flex items-center justify-center shadow-md">
                {fullName ? fullName.charAt(0) : <User className="w-7 h-7" />}
              </div>
              <div>
                <h2 className={`text-xl font-bold ${fullName ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                  {fullName || 'Name not set'}
                </h2>
                <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" /> {designation || '—'}
                  </span>
                  •
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Building className="w-3.5 h-3.5 text-blue-600" /> {department || '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
              <Field label="Job Role" value={text(profile?.job_role)} />
              <Field label="Current Assignment" value={text(profile?.current_assignment)} />
              <Field label="Educational Qualification" value={text(profile?.educational_qualification)} />
              <Field
                label="Experience Level"
                value={
                  typeof profile?.experience_years === 'number' && profile.experience_years > 0
                    ? `${profile.experience_years} Years`
                    : null
                }
              />
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 sm:col-span-2">
                <div className="text-slate-400 font-medium mb-1">Previous Trainings</div>
                <div className="flex flex-wrap gap-1.5">
                  {trainings.length > 0 ? (
                    trainings.map((tr: string, idx: number) => (
                      <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-medium">
                        {tr}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">None recorded</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Competencies Framework Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800">MoSPI 4-Domain Target Framework</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { domain: 'Statistical Competencies', desc: 'Survey Design, Sampling, National Accounts, Price Statistics, SDG Indicators, Metadata Standards, Data Quality Frameworks.' },
                { domain: 'Technical Competencies', desc: 'Python, R, SQL, Stata, SPSS, GIS, Data Visualization, AI/ML, Cloud Computing, Open Data.' },
                { domain: 'Digital Governance', desc: 'Cybersecurity, Data Privacy (DPDP Act), Digital Signatures, Government Cloud, Digital Public Infrastructure.' },
                { domain: 'Behavioural & Managerial', desc: 'Leadership, Communication, Survey Project Management, Ethics, Decision Making, Change Management.' },
              ].map((d, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center space-x-2 mb-1.5">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-900">{d.domain}</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{d.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
