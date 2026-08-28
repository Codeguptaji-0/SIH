"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Sparkles, User, Award, BookOpen, LogOut, Globe } from 'lucide-react';
import { useLanguage } from '../app/context/LanguageContext';
import { useAuth } from '../app/context/AuthContext';

interface NavbarProps {
  currentRole?: string;
  userName?: string;
  onRoleSwitch?: (role: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  userName,
  onRoleSwitch
}) => {
  const router = useRouter();
  const { language, toggleLanguage, t } = useLanguage();
  const { user, logout } = useAuth();

  const activeRole = currentRole || user?.role || 'OFFICIAL';
  // No fallback name: inventing a person here made every screen look like it
  // was showing a real officer's record even when nothing had loaded.
  const activeName = userName || user?.full_name || '';

  /**
   * Switch persona.
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
    const email = role === 'ADMIN' ? 'admin@skillsetu.demo' : role === 'TRAINER' ? 'trainer@skillsetu.demo' : 'official@skillsetu.demo';
    router.push(`/login?email=${encodeURIComponent(email)}`);
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
    <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Branding & SIH Badge */}
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="bg-blue-600 p-2 rounded-lg text-white font-bold tracking-wider group-hover:bg-blue-500 transition-colors">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                {t('appTitle')} <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded font-mono">SIH26101</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1 font-medium tracking-wide">
                MoSPI • {t('appSubtitle')}
              </span>
            </div>
          </Link>
        </div>

        {/* Middle: Role Selector Switcher */}
        <div className="hidden md:flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => handleSwitch('OFFICIAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeRole === 'OFFICIAL' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Official
          </button>
          <button
            onClick={() => handleSwitch('TRAINER')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeRole === 'TRAINER' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Trainer
          </button>
          <button
            onClick={() => handleSwitch('ADMIN')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeRole === 'ADMIN' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Admin
          </button>
        </div>

        {/* Right: Language Switcher, Demo Mode Badge & User Profile */}
        <div className="flex items-center space-x-3">
          {/* Priority 6: Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
            title="Toggle Language / भाषा बदलें"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('switchLanguage')}</span>
          </button>

          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            DEMO MODE
          </div>

          <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              {activeName ? activeName.charAt(0) : <User className="w-3.5 h-3.5" />}
            </div>
            <div className="hidden sm:block text-left">
              {activeName && (
                <div className="text-xs font-semibold text-slate-200">{activeName}</div>
              )}
              <div className="text-[10px] text-slate-400 font-medium">{activeRole}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            aria-label={t('logout') || 'Sign out'}
            title={t('logout') || 'Sign out'}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

      </div>
    </header>
  );
};

