/** @type {import('tailwindcss').Config} */
// Palette, typography and motion all come straight from Dansk Psykolog Forenings
// designmanual (juni 2024). See src/design/tokens.ts for the full derivation.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dp: {
          // Grundfarver
          navy: {
            DEFAULT: '#3a557d',   // BLÅ, Pantone 7545 C
            900: '#16233a',       // deep tone-i-tone extension for hero surfaces
            800: '#1e3050',
            700: '#2a4368',
            600: '#3a557d',
            500: '#5a76a0',
            400: '#8299bb',
            300: '#aebdd4',
            200: '#d4dbe1',       // LYS BLÅ, Pantone 642 C
            100: '#e7ebef',
            50:  '#f3f5f7',
          },
          grey: { DEFAULT: '#f4f1f1', 50: '#faf9f9', 100: '#f4f1f1', 200: '#e6e1e1' },
          ink: '#000000',

          // Accentfarver — brand hex, with the 60/30/15 tones from the manual
          lilla:  { DEFAULT: '#4e4897', 60: '#8987c1', 30: '#bcbbde', 15: '#dbdaed' },
          gron:   { DEFAULT: '#329d9e', 60: '#8ebec0', 30: '#c4dcdb', 15: '#e0eded' },
          rod:    { DEFAULT: '#d24e46', 60: '#e39687', 30: '#f1c7bb', 15: '#f6e1d8' },
          orange: { DEFAULT: '#df790d', 60: '#edac73', 30: '#f6d3b1', 15: '#f9e8d4' },
          blaa:   { DEFAULT: '#4c7bbd', 60: '#8da6d6', 30: '#c1cde9', 15: '#dfe5f4' },
          gul:    { DEFAULT: '#eab922', 60: '#f2d57a', 30: '#f8eabd', 15: '#fcf8e9' },
          studerende: '#4fa388',
        },
        // Series slots — validated ordering, see src/design/tokens.ts
        series: {
          1: '#4c7bbd', 2: '#df790d', 3: '#179fa0',
          4: '#d24e46', 5: '#4e4897', 6: '#d8a90c',
        },
      },
      fontFamily: {
        // dp.dk's own web typography, per the manual's DP.DK page
        serif: ['"IBM Plex Serif"', 'Charter', 'Cambria', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(2.75rem, 7vw, 5.5rem)', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        'display-lg': ['clamp(2rem, 4.5vw, 3.625rem)', { lineHeight: '1.02', letterSpacing: '-0.025em' }],
        'display-md': ['clamp(1.5rem, 3vw, 2.25rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        kicker: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.16em' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,35,58,0.04), 0 8px 24px -12px rgba(22,35,58,0.18)',
        'card-hover': '0 2px 4px rgba(22,35,58,0.06), 0 20px 44px -16px rgba(22,35,58,0.28)',
        band: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
      },
      keyframes: {
        'band-grow':   { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        'fade-up':     { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer:       { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring':  { '0%': { transform: 'scale(0.85)', opacity: '0.7' }, '70%,100%': { transform: 'scale(1.9)', opacity: '0' } },
        marquee:       { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        'band-grow': 'band-grow 1.1s cubic-bezier(0.22,1,0.36,1) both',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 2.2s infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.22,1,0.36,1) infinite',
        marquee: 'marquee 42s linear infinite',
      },
      transitionTimingFunction: { dp: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
}
