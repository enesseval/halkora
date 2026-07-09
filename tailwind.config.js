/** @type {import('tailwindcss').Config} */
// NOTE: This palette MIRRORS src/theme/tokens.ts, which is the single source of
// truth used by all components. Keep the two in sync if a color ever changes.
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bgBase: '#0D0E11',
        bgSurface: '#15171C',
        bgElevated: '#1D2027',
        strokeSubtle: '#262A33',
        textPrimary: '#F4F5F7',
        textSecondary: '#9AA0AC',
        textTertiary: '#5D6370',
        ember: '#FF6B47',
        emberSoft: 'rgba(255,107,71,0.12)',
        joker: '#E0B34C',
        waiting: '#3A3F4A',
      },
      borderRadius: {
        card: '24px',
        pill: '28px',
        badge: '12px',
        sheet: '32px',
      },
    },
  },
  plugins: [],
};
