/**
 * ReportSetu design tokens.
 *
 * Brand palette comes from the Figma reference (forest sidebar, sage canvas,
 * teal actions, terracotta badges). To keep every screen on one palette, the
 * stock Tailwind families used across older pages (stone, slate, emerald, red,
 * rose, amber, blue…) are remapped onto these tokens instead of being rewritten
 * class by class.
 */

// Sage-tinted neutral used for all text, borders and surfaces.
const neutral = {
  50: '#F7F9F8', 100: '#EFF3F1', 200: '#E2E9E5', 300: '#CBD6D0', 400: '#9AABA3',
  500: '#6D7F77', 600: '#52635C', 700: '#3D4C46', 800: '#2A3732', 900: '#1B2622', 950: '#111A17',
};
// "Within range" / success.
const positive = {
  50: '#EEF6F1', 100: '#DDEDE3', 200: '#BFDCC9', 300: '#93C4A5', 400: '#5FA57B',
  500: '#3A8A5C', 600: '#2C7049', 700: '#245A3C', 800: '#1E4A32', 900: '#183C29', 950: '#0F271A',
};
// "Notably outside range" / destructive.
const critical = {
  50: '#FDF2F0', 100: '#FBE6E3', 200: '#F6C4C0', 300: '#EE9C94', 400: '#E06F64',
  500: '#CC4A3D', 600: '#B53629', 700: '#9D2D22', 800: '#7F251C', 900: '#661F18', 950: '#40130F',
};
// "Slightly outside range" / waiting.
const caution = {
  50: '#FEF9EC', 100: '#FEF3D6', 200: '#FCE299', 300: '#F7CB5E', 400: '#E9AE34',
  500: '#C98F1A', 600: '#A87410', 700: '#8C6200', 800: '#6E4D05', 900: '#5A3F08', 950: '#3A2804',
};
// Brand teal for actions, links and information.
const teal = {
  50: '#EBF7F6', 100: '#D5EFEA', 200: '#AEDFD8', 300: '#7FCBC1', 400: '#4FB4A8',
  500: '#32A299', 600: '#288E86', 700: '#1F756E', 800: '#1B5E59', 900: '#184D49', 950: '#0F3330',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#EEF4F1',
          100: '#DCE8E2',
          200: '#B7CFC4',
          950: '#152C25',
          900: '#1E3F35',
          850: '#264E42',
          800: '#2A554A',
          700: '#35695C',
        },
        sage: {
          50: '#F5F8F6',
          100: '#ECF2ED',
          150: '#EAEFEA',
          200: '#E2E9E4',
          300: '#CAD8CF',
          400: '#A4BEB0',
          500: '#7B9F8D',
        },
        'accent-teal': '#32A299',
        accent: { teal: '#32A299' },
        teal,
        critical: { ...critical },
        amberalert: { 50: caution[50], 100: caution[100], 200: caution[200], 700: caution[700] },
        badgegreen: { 50: '#F0F6F2', 100: '#E4EDE8', 700: '#2B5246' },
        terracotta: { 500: '#D86E53', 600: '#C25A40' },
        ink: { DEFAULT: '#172B25', muted: '#5F736C', light: '#8FA19B' },

        // Legacy families remapped onto the brand system.
        stone: neutral, slate: neutral, gray: neutral, zinc: neutral, neutral,
        emerald: positive, green: positive, lime: positive,
        red: critical, rose: critical, pink: critical,
        amber: caution, yellow: caution, orange: caution,
        blue: teal, indigo: teal, sky: teal, cyan: teal, violet: teal, purple: teal,
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        // Figma uses one sans family throughout; legacy `font-serif` headings resolve to it.
        serif: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        hindi: ['"Noto Sans Devanagari"', '"IBM Plex Sans"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(30, 63, 53, 0.04), 0 8px 24px -12px rgba(30, 63, 53, 0.08)',
        hover: '0 8px 20px -4px rgba(30, 63, 53, 0.10)',
        modal: '0 24px 48px -12px rgba(15, 35, 29, 0.22)',
        xs: '0 1px 2px rgba(30, 63, 53, 0.05)',
        '2xs': '0 1px 1px rgba(30, 63, 53, 0.04)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
