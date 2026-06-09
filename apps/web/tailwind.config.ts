import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          secondary: '#0f0f1a',
          card: '#13131f',
          border: '#1e1e30',
        },
        accent: {
          green: '#00d084',
          red: '#ff4757',
          blue: '#4a9eff',
          purple: '#a855f7',
          yellow: '#ffd700',
        },
        text: {
          primary: '#e0e0f0',
          secondary: '#8888aa',
          muted: '#555570',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
