"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, UserCheck, BookOpen, BarChart3, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/** Landing page for each role after a successful sign-in. */
function destinationFor(role: string): string {
  if (role === 'ADMIN') return '/admin/analytics';
  if (role === 'TRAINER') return '/trainer/materials';
  return '/dashboard';
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  /**
   * Accounts that exist in database/seed.sql, listed by role rather than by
   * person so no identity is asserted in the client bundle. Selecting one only
   * fills in its email address - the password still has to be typed.
   */
  const personas = [
    {
      role: 'OFFICIAL',
      title: 'Statistical Officer',
      dept: 'Ministry of Statistics & Programme Implementation (MoSPI DIID)',
      email: 'official@skillsetu.demo',
      icon: UserCheck,
      color: 'bg-blue-600'
    },
    {
      role: 'TRAINER',
      title: 'Senior Faculty',
      dept: 'National Statistical Systems Training Academy (NSSTA)',
      email: 'trainer@skillsetu.demo',
      icon: BookOpen,
      color: 'bg-emerald-600'
    },
    {
      role: 'ADMIN',
      title: 'Director & Division Head',
      dept: 'Data Informatics & Innovation Division (DIID MoSPI)',
      email: 'admin@skillsetu.demo',
      icon: BarChart3,
      color: 'bg-purple-600'
    }
  ];

  /**
   * Allow other pages to hand over an email to sign in with, e.g. the navbar's
   * role switcher. Read from window.location in an effect rather than with
   * useSearchParams() so this page needs no Suspense boundary at build time.
   * Only the email is ever carried across - never a password.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const requested = new URLSearchParams(window.location.search).get('email');
    if (requested) {
      setEmail(requested);
      setNotice(`Enter the password for ${requested} to continue.`);
    }
  }, []);

  /**
   * Prefill the form for a seeded account.
   *
   * This used to be a one-click sign-in that read the shared demo password out
   * of the client bundle, which handed anyone who opened devtools an ADMIN
   * session. It now only fills the email field and moves focus to the password
   * box, so authentication always uses a password the user supplied.
   */
  const handlePersonaSelect = (p: typeof personas[0]) => {
    setError(null);
    setEmail(p.email);
    setPassword('');
    setNotice(`Email filled in for the ${p.role} account. Type its password to sign in.`);
    passwordRef.current?.focus();
  };

  /** Sign in with credentials typed into the form. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending('FORM');
    const result = await login(email, password);
    setPending(null);

    if (!result.ok || !result.user) {
      setError(result.error || 'Invalid email or password');
      return;
    }
    router.push(destinationFor(result.user.role));
  };

  const busy = pending !== null;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl">
            <Shield className="w-8 h-8" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">SkillSetu Sign In</h2>
          <p className="text-xs text-slate-400 mt-1">Ministry of Statistics &amp; Programme Implementation &bull; SIH26101</p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 text-left bg-red-500/10 border border-red-500/40 text-red-200 px-4 py-3 rounded-xl text-xs"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && !error && (
          <div className="text-left bg-blue-500/10 border border-blue-500/30 text-blue-200 px-4 py-3 rounded-xl text-xs">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {personas.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.email}
                type="button"
                onClick={() => handlePersonaSelect(p)}
                disabled={busy}
                aria-label={`Fill in the email address for the ${p.role} account`}
                className="bg-slate-800 border border-slate-700 p-5 rounded-2xl hover:border-blue-500 hover:bg-slate-800/80 transition-all text-left group flex flex-col justify-between disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div>
                  <div className={`${p.color} w-8 h-8 rounded-xl flex items-center justify-center text-white mb-3 shadow`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-blue-400 font-mono mb-1">{p.role}</div>
                  <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">{p.title}</h4>
                  <p className="text-xs text-slate-300 font-medium mt-0.5 font-mono">{p.email}</p>
                  <p className="text-[10px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">{p.dept}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-semibold text-slate-300 group-hover:text-white">
                  <span>Use this email</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-blue-400" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
          <span className="h-px flex-1 bg-slate-800" />
          SIGN IN WITH YOUR PASSWORD
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        {/* The only sign-in path. Every account, seeded or real, authenticates
            here with a password the user types. */}
        <form onSubmit={handleSubmit} className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 space-y-3 text-left">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Official Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="official@skillsetu.demo"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <input
              id="password"
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {pending === 'FORM' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl text-[11px] text-slate-400 font-mono">
          Passwords are verified server-side with PBKDF2-HMAC-SHA256 (600,000 iterations).
          No password is stored in the frontend bundle - ask your administrator for the
          credentials of a seeded account.
        </div>
      </div>
    </div>
  );
}
