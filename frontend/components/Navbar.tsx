'use client';

/*
 * Application masthead.
 *
 * Restyled to the statistical-release direction: paper ground, one ink rule at the
 * bottom, wordmark set in the display face, no translucency and no shadow.
 *
 * Two defects fixed here, both visible in the signed-out recording:
 *
 *   - `activeRole` used to fall back to the literal 'OFFICIAL'. With no session,
 *     the bar still printed an OFFICIAL badge, so a signed-out page looked signed
 *     in. It now renders nothing when there is no role to report.
 *   - A hardcoded "DEMO MODE" pill was always on, whatever the backend was
 *     actually doing. Removed. If that state needs showing, it has to come from
 *     GET /api/health, which names the live provider.
 */

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Globe } from 'lucide-react';
import { useLanguage } from '../app/context/LanguageContext';
import { useAuth } from '../app/context/AuthContext';

interface NavbarProps {
  currentRole?: string;
  userName?: string;
  onRoleSwitch?: (role: string) => void;
}

/** The three seeded accounts, in the order they appear in the switcher. */
const ACCOUNTS: { role: string; label: string; email: string }[] = [
  { role: 'OFFICIAL', label: 'Official', email: 'official@skillsetu.demo' },
  { role: 'TRAINER', label: 'Trainer', email: 'trainer@skillsetu.demo' },
  { role: 'ADMIN', label: 'Admin', email: 'admin@skillsetu.demo' },
];

export const Navbar: React.FC<NavbarProps> = ({ currentRole, userName, onRoleSwitch }) => {
  const router = useRouter();
  const { toggleLanguage, t } = useLanguage();
  const { user, logout } = useAuth();

  // No fallback role and no fallback name: inventing either made every screen
  // look like it was showing a real officer's record even when nothing had loaded.
  const activeRole = currentRole || user?.role || '';
  const activeName = userName || user?.full_name || '';

  /**
   * Switch account.
   *
   * A parent can handle this locally; otherwise there is nothing this component
   * can legitimately do except send the user to sign in as that account. It used
   * to call loginPersona(email), which authenticated using a password compiled
   * into the bundle. Only the email is passed along - the password is typed on
   * the login page.
   */
  const handleSwitch = (role: string) => {
    if (onRoleSwitch) {
      onRoleSwitch(role);
      return;
    }
    const account = ACCOUNTS.find((a) => a.role === role);
    router.push(`/login?email=${encodeURIComponent(account?.email ?? '')}`);
  };

  /** Revoke the session server-side before leaving, then go to the login page. */
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-ink bg-paper">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Wordmark. The release masthead, reduced to bar height. */}
        <Link href="/" className="flex min-w-0 items-baseline gap-2.5">
          <span className="font-display text-lg font-extrabold uppercase tracking-tightest text-ink">
            {t('appTitle')}
          </span>
          <span className="hidden font-mono text-[11px] text-slate-400 sm:inline">SIH26101</span>
          <span className="eyebrow hidden truncate lg:inline">MoSPI · {t('appSubtitle')}</span>
        </Link>

        {/*
         * Account switcher. This does not change the current session - it sends
         * the user to the login page with that account's email prefilled - so it
         * is labelled as accounts rather than as a view toggle.
         */}
        <nav aria-label="Accounts" className="hidden md:flex">
          {ACCOUNTS.map((a) => {
            const on = activeRole === a.role;
            return (
              <button
                key={a.role}
                type="button"
                onClick={() => handleSwitch(a.role)}
                aria-current={on ? 'true' : undefined}
                className={`border-b-2 px-3 pb-1 pt-1.5 text-xs font-medium transition-colors ${
                  on ? 'border-navy-600 text-ink' : 'border-transparent text-slate-400 hover:text-ink'
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleLanguage}
            className="inline-flex h-8 items-center gap-1.5 border border-rule bg-white px-2.5 text-xs font-medium text-ink transition-colors hover:border-ink"
            title="Toggle language / भाषा बदलें"
          >
            <Globe className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>{t('switchLanguage')}</span>
          </button>

          {/* Identity. Rendered only when there is something true to report. */}
          {(activeName || activeRole) && (
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 place-items-center bg-ink font-display text-xs font-bold text-paper"
              >
                {activeName ? activeName.charAt(0).toUpperCase() : '—'}
              </span>
              <div className="hidden leading-tight sm:block">
                {activeName && (
                  <div className="text-xs font-medium text-ink">{activeName}</div>
                )}
                {activeRole && <div className="eyebrow mt-0.5">{activeRole}</div>}
              </div>
            </div>
          )}

          {user && (
            <button
              type="button"
              onClick={handleLogout}
              aria-label={t('logout') || 'Sign out'}
              title={t('logout') || 'Sign out'}
              className="grid h-8 w-8 place-items-center border border-transparent text-slate-400 transition-colors hover:border-rule hover:text-ink"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
