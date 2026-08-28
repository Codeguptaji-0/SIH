/** @type {import('tailwindcss').Config} */

/*
 * SkillSetu design tokens - "statistical release".
 *
 * The visual reference is a printed release from an official statistics office:
 * paper ground, ink text, hairline rules doing the work that borders and shadows
 * usually do, one institutional accent, and figures that line up in columns
 * because they are set with tabular numerals. Rounded translucent cards, gradient
 * headlines and glowing buttons are the opposite of that and have all been
 * removed at the token level.
 *
 * Tailwind's own `slate`, `blue`, `emerald`, `amber`, `rose` and `red` scales are
 * deliberately REDEFINED here rather than sitting alongside new names. Nineteen
 * pages already reference them, so remapping the scale restyles the whole app
 * from one file and no page can quietly keep the old palette. If you need the
 * stock Tailwind blue for something, you are probably fighting the design.
 */

// Ink through paper. Warm-neutral rather than the blue-grey of stock slate,
// because a blue-grey page under a navy accent reads as "software", and this
// product is meant to read as a government publication.
const NEUTRAL = {
  DEFAULT: '#5A6472',
  50: '#FAFAF7',   // paper
  100: '#F1F0EA',  // sunken paper, table stripes
  200: '#D9D7CE',  // hairline rule
  300: '#BFBCB0',
  400: '#8A9099',  // muted label
  500: '#5A6472',  // secondary text
  600: '#4A525E',
  700: '#343B45',
  800: '#22272F',
  900: '#14181F',  // ink
  950: '#0B0E13',
};

// The single accent. Close to the navy used across Government of India mastheads,
// dark enough to pass AA on paper at body size, so it works for links as well as
// fills.
const NAVY = {
  DEFAULT: '#16365C',
  50: '#EEF1F6',
  100: '#DDE3EC',
  200: '#B9C4D6',
  300: '#8B9BB6',
  400: '#5C7196',
  500: '#2F4C77',
  600: '#16365C',
  700: '#112946',
  800: '#0D2038',
  900: '#0A1828',
  950: '#060F1A',
};

// Competency bands. Three inks a statistical publication would actually use -
// they read as printed, not as traffic lights, and each is legible on paper.
const STRONG = {
  DEFAULT: '#1F6B4A',
  50: '#EDF4F0', 100: '#D9E9E1', 200: '#B0D2C2', 300: '#7FB49C',
  400: '#4C8F71', 500: '#2A7A56', 600: '#1F6B4A', 700: '#17553B',
  800: '#11402C', 900: '#0C2E20', 950: '#071B13',
};
const WATCH = {
  DEFAULT: '#A9741B',
  50: '#F8F2E5', 100: '#F0E5C9', 200: '#E1CB96', 300: '#CFAD5F',
  400: '#BC9034', 500: '#A9741B', 600: '#8E6116', 700: '#734E12',
  800: '#573B0E', 900: '#3D290A', 950: '#241806',
};
const GAP = {
  DEFAULT: '#9C3B2E',
  50: '#F8EEEC', 100: '#F0DAD6', 200: '#E0B4AC', 300: '#CC8A7E',
  400: '#B45F50', 500: '#9C3B2E', 600: '#853127', 700: '#6B2720',
  800: '#511E18', 900: '#3A1511', 950: '#210C0A',
};

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: NEUTRAL[50], sunken: NEUTRAL[100] },
        ink: { DEFAULT: NEUTRAL[900], soft: NEUTRAL[700] },
        rule: { DEFAULT: NEUTRAL[200], strong: NEUTRAL[300] },
        navy: NAVY,
        strong: STRONG,
        watch: WATCH,
        gap: GAP,

        // Remapped stock scales - see the note at the top of this file.
        slate: NEUTRAL,
        gray: NEUTRAL,
        zinc: NEUTRAL,
        neutral: NEUTRAL,
        stone: NEUTRAL,
        blue: NAVY,
        indigo: NAVY,
        sky: NAVY,
        cyan: NAVY,
        emerald: STRONG,
        green: STRONG,
        teal: STRONG,
        amber: WATCH,
        yellow: WATCH,
        orange: WATCH,
        rose: GAP,
        red: GAP,
        pink: GAP,
        purple: { ...NAVY, DEFAULT: '#3F3556', 500: '#4C4067', 600: '#3F3556', 700: '#332B47' },
        violet: { ...NAVY, DEFAULT: '#3F3556', 500: '#4C4067', 600: '#3F3556', 700: '#332B47' },

        govBlue: NAVY,
        govOrange: WATCH.DEFAULT,
        govGreen: STRONG.DEFAULT,
      },

      fontFamily: {
        // Archivo carries a width axis, so headlines can be set slightly expanded
        // the way a statistical yearbook cover is, instead of relying on size alone.
        display: ['Archivo', 'Archivo Expanded', 'Helvetica Neue', 'Arial Narrow', 'sans-serif'],
        sans: ['IBM Plex Sans', 'IBM Plex Sans Devanagari', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },

      letterSpacing: {
        tightest: '-0.035em',
        eyebrow: '0.14em',
      },

      // Paper does not have rounded corners. `full` survives for status dots.
      borderRadius: {
        none: '0px', sm: '1px', DEFAULT: '2px', md: '2px',
        lg: '2px', xl: '2px', '2xl': '3px', '3xl': '3px', full: '9999px',
      },

      // Rules replace shadows. The two that remain are for genuinely floating
      // things - a dropdown, the assistant panel - and are kept nearly flat.
      boxShadow: {
        none: 'none', sm: 'none', DEFAULT: 'none', md: 'none',
        lg: '0 1px 0 0 rgba(20,24,31,0.08), 0 8px 24px -16px rgba(20,24,31,0.28)',
        xl: '0 1px 0 0 rgba(20,24,31,0.08), 0 12px 32px -18px rgba(20,24,31,0.32)',
        '2xl': '0 1px 0 0 rgba(20,24,31,0.08), 0 16px 40px -20px rgba(20,24,31,0.34)',
        inner: 'inset 0 1px 0 0 rgba(20,24,31,0.06)',
      },

      backgroundImage: {
        // A 4px ruled grid, for the one place that wants the feel of graph paper.
        ledger:
          'repeating-linear-gradient(to bottom, transparent 0, transparent 27px, ' +
          NEUTRAL[200] + ' 27px, ' + NEUTRAL[200] + ' 28px)',
      },

      keyframes: {
        'rule-in': { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
        'row-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'rule-in': 'rule-in 700ms cubic-bezier(0.16,1,0.3,1) both',
        'row-in': 'row-in 420ms cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
};
