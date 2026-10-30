/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B2545',
          dark: '#07182c',
          light: '#133966',
        },
        teal: {
          DEFAULT: '#13A89E',
          dark: '#0f857d',
          light: '#2dd4bf',
        },
        amber: {
          DEFAULT: '#F2A541',
          dark: '#d98620',
          light: '#fcd34d',
        },
        risk: {
          DEFAULT: '#D64545',
          dark: '#b32b2b',
          light: '#f87171',
        },
        surface: {
          bg: '#F5F7FA',
          card: '#FFFFFF',
          border: '#E2E8F0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
