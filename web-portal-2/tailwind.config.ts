import type { Config } from 'tailwindcss'

const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
        body: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Cambria Math',
          'Noto Sans Symbols 2',
          'sans-serif',
        ],
        mono: ['SF Mono', 'SFMono-Regular', 'Cascadia Code', 'Menlo', 'monospace'],
      },
      colors: {
        ink: {
          100: token('ink-100'),
          300: token('ink-300'),
          950: token('ink-950'),
          800: token('ink-800'),
          700: token('ink-700'),
          600: token('ink-600'),
          500: token('ink-500'),
          400: token('ink-400'),
        },
        paper: token('paper'),
        raised: token('paper-raised'),
        panel: token('paper-raised'),
        text: token('ink-950'),
        line: token('line'),
        accent: { DEFAULT: token('accent'), deep: token('accent-deep') },
        good: token('good'),
        live: token('live'),
        warn: token('warn'),
      },
    },
  },
  plugins: [],
}
export default config
