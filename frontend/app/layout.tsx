import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

export const metadata: Metadata = {
  title: 'SkillSetu — competency assessment for the Indian Statistical System',
  description:
    'Measures where a statistical officer stands against their role, then routes them to the iGOT Karmayogi and NSSTA TPAC courses that close the gap. Smart India Hackathon 2026, problem statement SIH26101 (MoSPI).',
};

/*
 * Typefaces are loaded with a plain stylesheet <link> rather than next/font.
 *
 * next/font fetches the files at build time, which turns a temporary lack of
 * network into a failed build - a bad trade three days before a demo. A
 * stylesheet link degrades instead: if it cannot load, the fallback stack in
 * tailwind.config.js takes over and the layout still holds.
 *
 * Archivo is loaded with its width axis (100..125) because headlines in this
 * design are set slightly expanded, the way a statistical yearbook cover is.
 * IBM Plex Sans Devanagari is loaded alongside the Latin family so the Hindi
 * locale is set in the same voice instead of falling back to a system serif.
 */
const FONT_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Archivo:wdth,wght@100..125,400..800' +
  '&family=IBM+Plex+Sans:wght@400;500;600;700' +
  '&family=IBM+Plex+Sans+Devanagari:wght@400;500;600;700' +
  '&family=IBM+Plex+Mono:wght@400;500' +
  '&display=swap';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />
        <meta name="theme-color" content="#14181f" />
      </head>
      <body className="min-h-screen bg-paper text-ink antialiased">
        <AuthProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
