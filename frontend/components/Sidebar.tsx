'use client';

/*
 * Section navigation.
 *
 * Set as a table of contents rather than an app rail: mono section numbers, no
 * icons, a navy rule marking the current section. Icons were dropped on purpose -
 * twelve lucide glyphs down the left edge is the single strongest "generated
 * dashboard" tell in the old design, and a release numbers its contents instead.
 *
 * The heading no longer prints "{role} MENU". With no session that read
 * "OFFICIAL MENU", which claimed a role the visitor did not have.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '../app/context/LanguageContext';

interface SidebarProps {
  role?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ role }) => {
  const pathname = usePathname();
  const { t } = useLanguage();

  const officialNav = [
    { label: t('navDashboard'), href: '/dashboard' },
    { label: t('navProfile'), href: '/dashboard/profile' },
    { label: t('navAssessment'), href: '/dashboard/assessment' },
    { label: t('navAdaptive'), href: '/dashboard/adaptive' },
    { label: t('navLearningPath'), href: '/dashboard/learning-path' },
    { label: t('navProgress'), href: '/dashboard/progress' },
    { label: t('navVirtualLab'), href: '/dashboard/virtual-lab' },
  ];

  const trainerNav = [
    { label: t('navMaterials'), href: '/trainer/materials' },
    { label: t('navQuestionBank'), href: '/trainer/questions' },
    { label: t('navReview'), href: '/trainer/review' },
  ];

  const adminNav = [
    { label: t('navAnalytics'), href: '/admin/analytics' },
    { label: t('domainReadiness'), href: '/admin/analytics#readiness' },
    { label: t('navProgress'), href: '/admin/analytics#demand' },
  ];

  const navItems = role === 'ADMIN' ? adminNav : role === 'TRAINER' ? trainerNav : officialNav;

  return (
    <aside className="flex w-60 min-h-[calc(100vh-3.5rem)] flex-col justify-between border-r border-rule bg-paper px-4 py-5">
      <div className="space-y-8">
        <div>
          <p className="eyebrow px-2">Contents</p>
          <nav className="mt-3 border-t border-rule">
            {navItems.map((item, i) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-baseline gap-3 border-b border-rule border-l-2 py-2.5 pl-2 pr-1 text-[0.8125rem] transition-colors ${
                    isActive
                      ? 'border-l-navy-600 bg-white font-medium text-ink'
                      : 'border-l-transparent text-slate-500 hover:bg-white hover:text-ink'
                  }`}
                >
                  <span className="font-mono text-[10px] text-slate-400 tnum">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Standing note on what the scores are measured against. */}
        <div className="border-l-2 border-rule-strong pl-3">
          <p className="text-xs font-medium text-ink">MoSPI competency framework</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Four official domains: statistical, technical, digital governance, and managerial.
          </p>
        </div>
      </div>

      <p className="mt-8 border-t border-rule pt-4 text-[10px] leading-relaxed text-slate-400">
        Smart India Hackathon 2026
        <br />
        Problem statement SIH26101
      </p>
    </aside>
  );
};
