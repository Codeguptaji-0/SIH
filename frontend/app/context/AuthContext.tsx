'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

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

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loginPersona: (email: string) => Promise<UserProfile | null>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loginPersona: async () => null,
  logout: () => {},
  getAuthHeaders: () => ({}),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Auto initialize default demo persona on mount
  useEffect(() => {
    loginPersona('official@skillsetu.demo').catch(() => {});
  }, []);

  const loginPersona = async (email: string): Promise<UserProfile | null> => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data: UserProfile = await res.json();
        setUser(data);
        if (data.access_token) {
          setToken(data.access_token);
        }
        return data;
      }
    } catch (e) {
      console.warn('Auth backend offline or starting up:', e);
    }
    return null;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  return (
    <AuthContext.Provider value={{ user, token, loginPersona, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
