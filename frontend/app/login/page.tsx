'use client';

/*
 * Sign-in.
 *
 * Restyled to the statistical-release direction, and extended to honour the
 * `?next=` parameter that components/RequireAuth.tsx now attaches when it turns a
 * signed-out visitor away from a guarded page. Without that, someone sent here
 * from /dashboard/progress landed on /dashboard and had to navigate back.
 *
 * `next` is accepted only when it is a site-relative path ("/..." but not "//..."),
 * so the parameter cannot be used to bounce a signed-in officer to another origin.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/** Landing page for each role after a successful sign-in. */
function destinationFor(role: string): string {
  if (role === 'ADMIN') return '/admin/analytics';
  if (role === 'TRAINER') return '/trainer/materials';
  return '/dashboard';
}

/**
 * Accounts that exist in database/seed.sql, listed by role rather than by person
 * so no identity is asserted in the client bundle. Selecting one only fills in its
 * email address - the password still has to be typed.
 */
const ACCOUNTS = [
  {
    role: 'OFFICIAL',
    title: 'Statistical Officer',
    dept: 'Ministry of Statistics and Programme Implementation, DIID',
    email: 'official@skillsetu.demo',
  },
  {
    role: 'TRAINER',
    title: 'Senior Faculty',
    dept: 'National Statistical Systems Training Academy',
    email: 'trainer@skillsetu.demo',
  },
  {
    role: 'ADMIN',
    title: 'Director, Division Head',
    dept: 'Data Informatics and Innovation Division, MoSPI',
    email: 'admin@skillsetu.demo',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [next, setNext] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  /**
   * Read the handover parameters.
   *
   * Read from window.location in an effect rather than with useSearchParams() so
   * this page needs no Suspense boundary at build time. Only an email and a
   * relative path are ever carried across - never a password.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    const requestedEmail = params.get('email');
    if (requestedEmail) {
      setEmail(requestedEmail);
      setNotice(`Enter the password for ${requestedEmail} to continue.`);
    }

    const requestedNext = params.get('next');
    if (requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//')) {
      setNext(requestedNext);
      if (!requestedEmail) setNotice('Sign in to continue to the page you asked for.');
    }
  }, []);

  /**
   * Prefill the form for a seeded account.
   *
   * This used to be a one-click sign-in that read the shared demo password out of
   * the client bundle, which handed anyone who opened devtools an ADMIN session. It
   * now only fills the email field and moves focus to the password box, so
   * authentication always uses a password the user supplied.
   */
  const handleAccountSelect = (a: (typeof ACCOUNTS)[0]) => {
    setError(null);
    setEmail(a.email);
    setPassword('');
    setNotice(`Email filled in for the ${a.role} account. Type its password to sign in.`);
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
    // Back to the guarded page they were turned away from, if there was one.
    // A path their role cannot open is then handled by RequireAuth, not here.
    router.push(next || destinationFor(result.user.role));
  };

  const busy = pending !== null;

  return (
    <main className="min-h-screen bg-paper">
      {/* Departmental strip, matching the landing page. */}
      <div className="border-b border-rule">
        <div className="mx-auto flex h-10 w-full max-w-5xl items-center justify-between gap-4 px-5 md:px-8">
          <p className="eyebrow truncate">Ministry of Statistics and Programme Implementation</p>
          <a
            href="/"
            className="eyebrow shrink-0 text-navy-600 underline decoration-navy-200 underline-offset-4 hover:decoration-navy-600"
          >
            Home
          </a>
        </div>
      </div>

      <header className="border-b-2 border-ink">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-5 py-7 md:px-8">
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tightest text-ink">
            SkillSetu
          </h1>
          <p className="text-sm text-slate-500">
            Sign in &nbsp;·&nbsp; problem statement SIH26101
          </p>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-10 md:grid-cols-12 md:gap-12 md:px-8">
        <div className="md:col-span-6">
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 border-l-2 border-gap-600 bg-gap-50 px-4 py-3 text-xs text-gap-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          {notice && !error && (
            <div className="mb-5 border-l-2 border-navy-600 bg-navy-50 px-4 py-3 text-xs text-navy-700">
              {notice}
            </div>
          )}

          {/* The only sign-in path. Every account, seeded or real, authenticates
              here with a password the user types. */}
          <form onSubmit={handleSubmit} className="border border-rule bg-white">
            <div className="border-b border-ink px-5 py-3">
              <p className="eyebrow">Credentials</p>
            </div>
            <div className="space-y-5 px-5 py-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-ink">
                  Official email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="official@skillsetu.demo"
                  className="h-11 w-full border border-rule-strong bg-paper px-3 font-mono text-sm text-ink placeholder-slate-300 transition-colors hover:border-slate-400 focus:border-navy-600"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-ink">
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
                  className="h-11 w-full border border-rule-strong bg-paper px-3 text-sm text-ink placeholder-slate-300 transition-colors hover:border-slate-400 focus:border-navy-600"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 w-full items-center justify-center gap-2 border border-navy-600 bg-navy-600 text-sm font-medium text-paper transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending === 'FORM' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Verifying
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Passwords are verified server-side with PBKDF2-HMAC-SHA256 at 600,000 iterations.
            No password is stored in the frontend bundle. Ask your administrator for the
            credentials of a seeded account.
          </p>

        </div>

        {/* The seeded accounts, as a ruled list rather than three tappable cards.
            Each button fills in an email address and nothing else. */}
        <section className="md:col-span-6">
          <p className="eyebrow">Seeded accounts</p>
          <p className="mt-1.5 text-sm text-slate-500">
            Three roles exist in this prototype. Choosing one fills in its email address;
            the password is still typed into the form.
          </p>
          <ul className="m-0 mt-4 list-none border-t border-ink p-0">
            {ACCOUNTS.map((a) => (
              <li
                key={a.email}
                className="flex items-start justify-between gap-4 border-b border-rule py-4"
              >
                <div className="min-w-0">
                  <p className="eyebrow">{a.role}</p>
                  <p className="mt-1.5 text-sm font-medium text-ink">{a.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{a.dept}</p>
                  <p className="mt-1.5 truncate font-mono text-xs text-slate-500">{a.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAccountSelect(a)}
                  disabled={busy}
                  aria-label={`Fill in the email address for the ${a.role} account`}
                  className="shrink-0 border border-rule-strong bg-white px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        </section>

      </div>
    </main>
  );
}
