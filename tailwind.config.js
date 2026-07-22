/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#15305E',
        navyDeep: '#0F2347',
        ink: '#1B2537',
        sub: '#6A7488',
        bg: '#F3F5F9',
        card: '#FFFFFF',
        line: '#E7EBF1',
        faint: '#F7F9FC',
        saffron: '#E2892C',
        green: '#1E8A5B',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(21,48,94,0.05), 0 8px 24px rgba(21,48,94,0.07)',
        lift: '0 2px 4px rgba(21,48,94,0.06), 0 14px 36px rgba(21,48,94,0.12)',
      },
    },
  },
  plugins: [],
};
