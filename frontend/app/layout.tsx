import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SkillSetu — AI-Powered Competency Bridge for Government Officials',
  description: 'Smart India Hackathon 2026 Problem Statement SIH26101 under Ministry of Statistics and Programme Implementation (MoSPI)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
