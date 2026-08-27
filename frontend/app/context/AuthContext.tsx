'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, getAccessToken, setAccessToken } from '../lib/api';

export interface UserProfile {
  id: string;
  email: string;
  role: 'OFFICIAL' | 'TRAINER' | 'ADMIN';
  full_name: string;
  designation: string;
  department: string;
  job_role?: string;
  current_assignment?: string;
  educational_qualification?: string;
  previous_trainings?: string[];
  access_token?: string;
}

/**
 * Password for the three seeded demo accounts in database/seed.sql.
 *
 * This is a demo convenience so a reviewer can sign in as any persona with one
 * click. It is a published credential for seeded accounts only - anyone can read
 * it in the client bundle, which is inherent to one-click login and is the reason
 * the quick-login buttons must be removed before any real deployment. Real
 * accounts authenticate through the email + password form, which posts to the
 * same endpoint and is subject to the same PBKDF2 verification.
 */
export const DEMO_PASSWORD = 'SkillSetu@2026';

/**
 * Outcome of a sign-in attempt.
 *
 * Deliberately a single shape with optional fields rather than a discriminated
 * union: this project compiles with `strict: false`, and without
 * strictNullChecks TypeScript will not narrow a union on a boolean literal
 * discriminant, so `if (!result.ok)` would not expose `result.error`. Callers
 * should check `ok` and `user` together.
 */
export interface LoginResult {
  ok: boolean;
  user?: UserProfile;
  error?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  /** False until the stored session has been checked, so guards do not fire early. */
  ready: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginPersona: (email: string) => Promise<UserProfile | null>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  ready: false,
  login: async () => ({ ok: false, error: 'Auth provider not mounted' }),
  loginPersona: async () => null,
  logout: () => {},
  getAuthHeaders: () => ({}),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /**
   * Restore an existing session on mount.
   *
   * This replaces an unconditional `loginPersona('official@skillsetu.demo')`
   * call, which signed everybody in as the same official the moment the app
   * loaded. That made the login screen decorative and meant the app was never
   * actually unauthenticated. Now a stored token is validated against
   * GET /api/auth/me, and a token the backend rejects is discarded.
   */
  useEffect(() => {
    const stored = getAccessToken();
    if (!stored) {
      setReady(true);
      return;
    }

    setToken(stored);
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (res.ok) {
          setUser((await res.json()) as UserProfile);
        } else {
          // Expired, revoked or otherwise invalid - do not keep pretending.
          setAccessToken(null);
          setToken(null);
        }
      })
      .catch(() => {
        // Backend unreachable; keep the token so a retry can still succeed.
      })
      .finally(() => setReady(true));
  }, []);

  /**
   * Authenticate with an email and password.
   *
   * Returns a result object rather than throwing, so callers can show the
   * backend's message. The backend deliberately returns the same "Invalid email
   * or password" text for an unknown email and a wrong password, so this does
   * not reveal which accounts exist.
   */
  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let error = 'Invalid email or password';
        try {
          const body = await res.json();
          if (typeof body?.detail === 'string') error = body.detail;
        } catch {
          // No JSON body; keep the default message.
        }
        return { ok: false, error };
      }

      const data = (await res.json()) as UserProfile;
      setUser(data);
      if (data.access_token) {
        setAccessToken(data.access_token);
        setToken(data.access_token);
      }
      return { ok: true, user: data };
    } catch (e) {
      console.warn('Auth request failed:', e);
      return {
        ok: false,
        error: 'Cannot reach the SkillSetu backend. Start it with: uvicorn app.main:app --reload',
      };
    }
  }, []);

  /**
   * One-click sign-in for a seeded demo persona.
   *
   * Kept so the existing call sites keep working; it now delegates to the real
   * password login rather than posting an email on its own.
   */
  const loginPersona = useCallback(
    async (email: string): Promise<UserProfile | null> => {
      const result = await login(email, DEMO_PASSWORD);
      return result.ok && result.user ? result.user : null;
    },
    [login]
  );

  const logout = useCallback(async () => {
    const current = getAccessToken();
    if (current) {
      try {
        // Adds the token to the backend revocation list before dropping it.
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // Logging out locally still matters even if the call fails.
      }
    }
    setUser(null);
    setToken(null);
    setAccessToken(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const current = token ?? getAccessToken();
    if (current) {
      headers['Authorization'] = `Bearer ${current}`;
    }
    return headers;
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ user, token, ready, login, loginPersona, logout, getAuthHeaders }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
