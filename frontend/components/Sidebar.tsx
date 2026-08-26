"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  UserCheck, 
  BookOpen, 
  Award, 
  TrendingUp, 
  FileText, 
  CheckSquare, 
  BarChart3, 
  FileCheck,
  HelpCircle,
  Code2
} from 'lucide-react';
import { useLanguage } from '../app/context/LanguageContext';

interface SidebarProps {
  role?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ role = 'OFFICIAL' }) => {
  const pathname = usePathname();
  const { t } = useLanguage();

  const officialNav = [
    { label: t('navDashboard'), href: '/dashboard', icon: LayoutDashboard },
    { label: t('navProfile'), href: '/dashboard/profile', icon: UserCheck },
    { label: t('navAssessment'), href: '/dashboard/assessment', icon: Award },
    { label: t('navLearningPath'), href: '/dashboard/learning-path', icon: BookOpen },
    { label: t('navProgress'), href: '/dashboard/progress', icon: TrendingUp },
    { label: t('navVirtualLab'), href: '/dashboard/virtual-lab', icon: Code2 },
  ];

  const trainerNav = [
    { label: t('navMaterials'), href: '/trainer/materials', icon: FileText },
    { label: t('navQuestionBank'), href: '/trainer/questions', icon: BookOpen },
    { label: t('navReview'), href: '/trainer/review', icon: FileCheck },
  ];

  const adminNav = [
    { label: t('navAnalytics'), href: '/admin/analytics', icon: BarChart3 },
    { label: t('domainReadiness'), href: '/admin/analytics#readiness', icon: Award },
    { label: t('navProgress'), href: '/admin/analytics#demand', icon: TrendingUp },
  ];

  const navItems = role === 'ADMIN' ? adminNav : (role === 'TRAINER' ? trainerNav : officialNav);

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between shadow-sm">
      <div className="space-y-6">
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2 font-mono">
            {role} MENU
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Info Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
          <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            MoSPI Competency Framework
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Evaluates 4 official domains: Statistical, Technical, Digital Governance, & Managerial.
          </p>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 leading-tight text-center">
        Smart India Hackathon 2026<br />
        Problem Statement SIH26101
      </div>
    </aside>
  );
};

