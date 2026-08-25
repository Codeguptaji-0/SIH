"use client";

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { UserCheck, Shield, CheckCircle2, Award, Briefcase, Building } from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch('/api/profile/me')
      .then((res) => res.json())
      .then((data) => setProfile(data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="OFFICIAL" userName={profile?.full_name || 'Ananya Sharma'} />

      <div className="flex flex-1">
        <Sidebar role="OFFICIAL" />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Official Competency Profile</h1>
            <p className="text-xs text-slate-500 mt-1">Role definition and MoSPI 4-domain competency framework targets</p>
          </div>

          {/* Profile Summary Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white font-bold text-2xl flex items-center justify-center shadow-md">
                {profile?.full_name ? profile.full_name.charAt(0) : 'A'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{profile?.full_name || 'Ananya Sharma'}</h2>
                <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" /> {profile?.designation || 'Statistical Officer'}
                  </span>
                  •
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Building className="w-3.5 h-3.5 text-blue-600" /> {profile?.department || 'Ministry of Statistics & Programme Implementation'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="text-slate-400 font-medium">Employee Persona ID</div>
                <div className="font-bold text-slate-800 font-mono mt-1">MOSPI-OFF-2026-881</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="text-slate-400 font-medium">Experience Level</div>
                <div className="font-bold text-slate-800 mt-1">6 Years (Mid-Level)</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="text-slate-400 font-medium">Primary Academy</div>
                <div className="font-bold text-slate-800 mt-1">NSSTA & iGOT Ecosystem</div>
              </div>
            </div>
          </div>

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
