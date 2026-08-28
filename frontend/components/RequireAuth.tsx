'use client';

/**
 * Route guard for every signed-in area of SkillSetu.
 *
 * The bug this fixes: only /admin/analytics checked for a session. Every
 * /dashboard/* and /trainer/* page rendered immediately and fired its API calls
 * from a `useEffect` on mount, whether or not a token existed. Signed out, the
 * result was not a redirect to the sign-in page - it was the full dashboard
 * chrome with "Missing Authorization header. Please log in." printed three times
 * in red where the officer's competency scores belong. The navbar even showed an
 * OFFICIAL badge, because the role was passed in as a literal prop rather than
 * read from the session, so the page looked signed in while being signed out.
 *
 * Two things matter here:
 *
 *   1. Children are not rendered until a session is confirmed. Returning a
 *      placeholder instead is what actually stops the unauthenticated fetches -
 *      a redirect alone would not, because the effects of a mounted page run
 *      before the navigation completes.
 *   2. Nothing is decided until `ready` is true. AuthContext restores a stored
 *      token and validates it against GET /api/auth/me asynchronously, so acting
 *      on `user === null` any earlier would sign out every returning visitor on
 *      the first frame.
 *
 * This is convenience and correctness, not a security boundary. Authorization is
 * enforced by `require_role(...)` on the FastAPI side; a client-side guard only
 * keeps an unauthorized person from seeing a broken shell of a page.
 */

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '../app/context/AuthContext';

export type Role = 'OFFICIAL' | 'TRAINER' | 'ADMIN';

/** Where each role belongs when it reaches an area it may not use. */
const HOME_FOR: Record<Role, string> = {
  OFFICIAL: '/dashboard',
  TRAINER: '/trainer/materials',
  ADMIN: '/admin/analytics',
};

interface RequireAuthProps {
  /** Roles permitted here. Omit to mean "any signed-in user". */
  allow?: Role[];
  children: React.ReactNode;
}

/** Full-height notice, so a guarded page never flashes its real content. */
function Interstitial({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="max-w-sm w-full border border-rule bg-white p-6">
        <div className="flex items-center gap-2 text-navy">{icon}</div>
        <h1 className="mt-3 font-display text-lg font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate">{detail}</p>
      </div>
    </div>
  );
}

export function RequireAuth({ allow, children }: RequireAuthProps) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const permitted = !allow || !user ? true : allow.includes(user.role);

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      // Carry the requested path so sign-in can return the user to it.
      const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
      return;
    }

    if (!permitted) {
      router.replace(HOME_FOR[user.role] ?? '/dashboard');
    }
  }, [ready, user, permitted, pathname, router]);

  if (!ready) {
    return (
      <Interstitial
        icon={<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        title="Checking your session"
        detail="Verifying your access token with the SkillSetu server."
      />
    );
  }

  if (!user) {
    return (
      <Interstitial
        icon={<Lock className="h-4 w-4" aria-hidden="true" />}
        title="Sign in to continue"
        detail="This area needs an official account. Taking you to the sign-in page."
      />
    );
  }

  if (!permitted) {
    return (
      <Interstitial
        icon={<Lock className="h-4 w-4" aria-hidden="true" />}
        title="Not available to your role"
        detail={`Your account is signed in as ${user.role}. Returning you to your own workspace.`}
      />
    );
  }

  return <>{children}</>;
}
