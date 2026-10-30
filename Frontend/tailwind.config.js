/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
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
        accent: {
          teal: '#32A299',
        },
        teal: {
          500: '#32A299',
          600: '#288E86',
          700: '#1F756E',
          50: '#EBF7F6',
          100: '#D5EFEA',
        },
        critical: {
          50: '#FDF2F0',
          100: '#FBEBEA',
          200: '#F6C4C0',
          600: '#B53629',
          700: '#9D2D22',
        },
        amberalert: {
          50: '#FEF9EC',
          100: '#FEF3D6',
          200: '#FCE299',
          700: '#8C6200',
        },
        badgegreen: {
          50: '#F0F6F2',
          100: '#E4EDE8',
          700: '#2B5246',
        },
        terracotta: {
          500: '#D86E53',
          600: '#C25A40',
        },
        ink: {
          DEFAULT: '#172B25',
          muted: '#5F736C',
          light: '#8FA19B',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"Inter"', 'system-ui', 'sans-serif'],
        hindi: ['"Noto Sans Devanagari"', '"IBM Plex Sans"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(30, 63, 53, 0.05), 0 10px 24px -8px rgba(30, 63, 53, 0.04)',
        hover: '0 8px 20px -4px rgba(30, 63, 53, 0.08)',
        modal: '0 24px 48px -12px rgba(15, 35, 29, 0.22)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
