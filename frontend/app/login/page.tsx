"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, UserCheck, BookOpen, BarChart3, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const personas = [
    {
      role: 'OFFICIAL',
      name: 'Ananya Sharma',
      title: 'Statistical Officer',
      dept: 'Ministry of Statistics & Programme Implementation (MoSPI DIID)',
      email: 'official@skillsetu.demo',
      icon: UserCheck,
      color: 'bg-blue-600',
      dest: '/dashboard'
    },
    {
      role: 'TRAINER',
      name: 'Dr. V. K. Rao',
      title: 'Senior Faculty',
      dept: 'National Statistical Systems Training Academy (NSSTA)',
      email: 'trainer@skillsetu.demo',
      icon: BookOpen,
      color: 'bg-emerald-600',
      dest: '/trainer/materials'
    },
    {
      role: 'ADMIN',
      name: 'Rajesh Kumar',
      title: 'Director & Division Head',
      dept: 'Data Informatics & Innovation Division (DIID MoSPI)',
      email: 'admin@skillsetu.demo',
      icon: BarChart3,
      color: 'bg-purple-600',
      dest: '/admin/analytics'
    }
  ];

  const handlePersonaSelect = async (p: typeof personas[0]) => {
    setLoading(true);
    try {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: p.email })
      });
      router.push(p.dest);
    } catch (e) {
      router.push(p.dest);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl">
            <Shield className="w-8 h-8" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">SkillSetu Demo Login</h2>
          <p className="text-xs text-slate-400 mt-1">Select a pre-configured government persona to test the MVP workflow</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {personas.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.email}
                onClick={() => handlePersonaSelect(p)}
                disabled={loading}
                className="bg-slate-800 border border-slate-700 p-5 rounded-2xl hover:border-blue-500 hover:bg-slate-800/80 transition-all text-left group flex flex-col justify-between"
              >
                <div>
                  <div className={`${p.color} w-8 h-8 rounded-xl flex items-center justify-center text-white mb-3 shadow`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-blue-400 font-mono mb-1">{p.role}</div>
                  <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">{p.name}</h4>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">{p.title}</p>
                  <p className="text-[10px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">{p.dept}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-semibold text-slate-300 group-hover:text-white">
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-blue-400" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl text-[11px] text-slate-400 font-mono">
          Single-click instant persona auth enabled for SIH 2026 Hackathon judging.
        </div>
      </div>
    </div>
  );
}
