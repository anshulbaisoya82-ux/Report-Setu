/**
 * ReportSetu design tokens — "clean & calm".
 *
 * Layout idea: white surfaces on a soft off-white canvas, separated by hairlines
 * rather than shadows; forest green only for primary actions and the active nav item;
 * semantic colours (ok / watch / critical) only where a value needs attention.
 *
 * Stock Tailwind families used by older pages (stone, slate, emerald, red, amber, blue…)
 * are remapped onto these tokens so every screen shares one palette.
 */

// Neutral with a faint green bias (text, borders, surfaces).
const neutral = {
  50: '#FAFBF9', 100: '#F3F5F2', 200: '#E7EAE5', 300: '#D5DBD4', 400: '#A3ADA7',
  500: '#75817B', 600: '#5B6862', 700: '#424D48', 800: '#2B3531', 900: '#16231E', 950: '#0E1714',
};
// Within range / success.
const positive = {
  50: '#F0F7F2', 100: '#E1EFE6', 200: '#C4E0CD', 300: '#98C8A8', 400: '#62A87C',
  500: '#3B8A5C', 600: '#2F7049', 700: '#275B3D', 800: '#204A33', 900: '#1A3C2A', 950: '#10261B',
};
// Notably outside range / destructive.
const critical = {
  50: '#FCF3F1', 100: '#FAE8E5', 200: '#F3CBC5', 300: '#E9A49B', 400: '#DA7468',
  500: '#C74E40', 600: '#B23B2E', 700: '#963126', 800: '#7A281F', 900: '#62211A', 950: '#3E1410',
};
// Slightly outside range / waiting.
const caution = {
  50: '#FDF8EE', 100: '#FBF0D9', 200: '#F5DEA8', 300: '#EDC56E', 400: '#DFA83D',
  500: '#C48A1F', 600: '#A36F12', 700: '#865A0C', 800: '#6A470B', 900: '#563A0B', 950: '#372405',
};
// Secondary accent (links, info, charts).
const teal = {
  50: '#EEF7F6', 100: '#D9EEEB', 200: '#B3DCD6', 300: '#84C5BC', 400: '#52A99F',
  500: '#2E8F86', 600: '#23776F', 700: '#1D615B', 800: '#1A4F4B', 900: '#18423F', 950: '#0E2B29',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        forest: {
          50: '#EEF4F1', 100: '#DCE8E2', 200: '#B9D1C6', 300: '#8FB3A3',
          700: '#2E6252', 800: '#285646', 850: '#1A3F34', 900: '#1F4A3D', 950: '#14302A',
        },
        sage: {
          50: '#FAFBF9', 100: '#F6F7F4', 150: '#F3F5F2', 200: '#EEF1EC', 300: '#E1E6DF', 400: '#C3CDC6', 500: '#8FA197',
        },
        canvas: '#F6F7F4',
        line: '#E7EAE5',
        'accent-teal': teal[500],
        accent: { teal: teal[500] },
        teal,
        critical: { ...critical },
        amberalert: { 50: caution[50], 100: caution[100], 200: caution[200], 700: caution[700] },
        badgegreen: { 50: positive[50], 100: positive[100], 700: positive[700] },
        terracotta: { 500: '#D9694C', 600: '#BF5639' },
        ink: { DEFAULT: '#16231E', muted: '#5B6862', light: '#8A958F' },

        // Legacy families remapped onto the system.
        stone: neutral, slate: neutral, gray: neutral, zinc: neutral, neutral,
        emerald: positive, green: positive, lime: positive,
        red: critical, rose: critical, pink: critical,
        amber: caution, yellow: caution, orange: caution,
        blue: teal, indigo: teal, sky: teal, cyan: teal, violet: teal, purple: teal,
      },
      fontFamily: {
        sans: ['"Instrument Sans"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Sans"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        hindi: ['"Noto Sans Devanagari"', '"Instrument Sans"', 'sans-serif'],
      },
      // Calmer weights across every page: "bold" reads as semibold.
      fontWeight: {
        bold: '600',
        extrabold: '650',
        black: '700',
      },
      // Hairline-first: surfaces are separated by borders, shadows stay faint.
      boxShadow: {
        '2xs': '0 1px 1px rgba(22, 35, 30, 0.03)',
        xs: '0 1px 2px rgba(22, 35, 30, 0.04)',
        sm: '0 1px 2px rgba(22, 35, 30, 0.04)',
        DEFAULT: '0 1px 2px rgba(22, 35, 30, 0.04)',
        md: '0 1px 2px rgba(22, 35, 30, 0.04), 0 4px 12px -6px rgba(22, 35, 30, 0.08)',
        lg: '0 1px 2px rgba(22, 35, 30, 0.04), 0 4px 12px -6px rgba(22, 35, 30, 0.08)',
        xl: '0 1px 2px rgba(22, 35, 30, 0.04), 0 8px 20px -10px rgba(22, 35, 30, 0.10)',
        card: '0 1px 2px rgba(22, 35, 30, 0.04)',
        hover: '0 2px 4px rgba(22, 35, 30, 0.05), 0 8px 20px -10px rgba(22, 35, 30, 0.12)',
        '2xl': '0 24px 48px -16px rgba(14, 23, 20, 0.25)',
        modal: '0 24px 48px -16px rgba(14, 23, 20, 0.25)',
      },
      borderRadius: {
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '18px',
      },
      fontSize: {
        // Smallest readable size; older 10–11px labels are migrated to `text-xs`.
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
      },
    },
  },
  plugins: [],
};
