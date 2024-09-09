/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  corePlugins: {
    preflight: false // This disables Tailwind's base styles
  },
  theme: {
    extend: {}
  },
  plugins: []
}
