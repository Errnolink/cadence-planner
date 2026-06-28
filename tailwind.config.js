/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Share Tech Mono', 'Courier New', 'monospace'],
        sans: ['Rajdhani', 'sans-serif'],
      },
      colors: {
        nerv: {
          black: '#0a0a0a',
          gunmetal: '#0f1117',
          panel: '#13161f',
          border: '#1e2030',
          orange: '#f97316',
          'orange-dim': '#c2540a',
          'orange-glow': '#fb923c',
          red: '#dc2626',
          'red-dim': '#991b1b',
          green: '#22c55e',
          'green-dim': '#15803d',
          amber: '#d97706',
          text: '#e2e8f0',
          muted: '#64748b',
          grid: 'rgba(249,115,22,0.06)',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1.2s step-end infinite',
        'scan': 'scan 4s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        scan: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100px' },
        }
      }
    },
  },
  plugins: [],
}
