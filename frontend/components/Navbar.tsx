"use client";

import React from 'react';
import Link from 'next/link';
import { Shield, Sparkles, User, Award, BookOpen, LogOut } from 'lucide-react';

interface NavbarProps {
  currentRole?: string;
  userName?: string;
  onRoleSwitch?: (role: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole = 'OFFICIAL',
  userName = 'Ananya Sharma',
  onRoleSwitch
}) => {
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
                SkillSetu <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded font-mono">SIH26101</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1 font-medium tracking-wide">
                MoSPI • Official Statistical System AI Bridge
              </span>
            </div>
          </Link>
        </div>

        {/* Middle: Role Selector Switcher */}
        <div className="hidden md:flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => onRoleSwitch && onRoleSwitch('OFFICIAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              currentRole === 'OFFICIAL' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Official Persona
          </button>
          <button
            onClick={() => onRoleSwitch && onRoleSwitch('TRAINER')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              currentRole === 'TRAINER' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Trainer Persona
          </button>
          <button
            onClick={() => onRoleSwitch && onRoleSwitch('ADMIN')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              currentRole === 'ADMIN' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Admin Persona
          </button>
        </div>

        {/* Right: Demo Mode Badge & User Profile */}
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            DEMO MODE
          </div>

          <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              {userName.charAt(0)}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-200">{userName}</div>
              <div className="text-[10px] text-slate-400 font-medium">{currentRole}</div>
            </div>
          </div>

          <Link href="/login" className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <LogOut className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </header>
  );
};
