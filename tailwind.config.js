/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],

  corePlugins: {
    preflight: false // This disables Tailwind's base styles
  },

  theme: {
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '4rem'
    },

    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '1800px',
      '4xl': '2500px',
      '5xl': '3200px'
    },

    spacing: {
      px: '1px',
      0: '0px',
      0.5: '0.125rem',
      1: '0.25rem',
      1.5: '0.375rem',
      2: '0.5rem',
      2.5: '0.625rem',
      3: '0.75rem',
      3.5: '0.875rem',
      4: '1rem',
      4.5: '1.125rem',
      5: '1.25rem',
      6: '1.5rem',
      7: '1.75rem',
      8: '2rem',
      9: '2.25rem',
      10: '2.5rem',
      11: '2.75rem',
      12: '3rem',
      14: '3.5rem',
      16: '4rem',
      18: '4.5rem',
      20: '5rem',
      24: '6rem',
      28: '7rem',
      32: '8rem',
      36: '9rem',
      40: '10rem',
      44: '11rem',
      48: '12rem',
      52: '13rem',
      56: '14rem',
      60: '15rem',
      64: '16rem',
      72: '18rem',
      80: '20rem',
      84: '22rem',
      90: '24rem',
      96: '26rem',
      100: '28rem',
      110: '32rem'
    },

    extend: {
      colors: {
        zinc: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b'
        },

        gray: {
          50: '#f8fbfc',
          100: '#f3f6fa',
          200: '#edf2f7',
          300: '#e2e8f0',
          400: '#cbd5e0',
          500: '#a0aec0',
          600: '#718096',
          700: '#4a5568',
          800: '#2d3748',
          900: '#1a202c',
          950: '#0a1016'
        },

        teal: {
          50: '#f0fdfa',
          100: '#e0fcff',
          200: '#bef8fd',
          300: '#87eaf2',
          400: '#54d1db',
          500: '#38bec9',
          600: '#2cb1bc',
          700: '#14919b',
          800: '#0e7c86',
          900: '#005860',
          950: '#022c28'
        },

        blue: {
          50: '#eff6ff',
          100: '#ebf8ff',
          200: '#bee3f8',
          300: '#90cdf4',
          400: '#63b3ed',
          500: '#4299e1',
          600: '#3182ce',
          700: '#2b6cb0',
          800: '#2c5282',
          900: '#2a4365',
          950: '#172554'
        },

        green: {
          50: '#fcfff5',
          100: '#fafff3',
          200: '#eaf9c9',
          300: '#d1efa0',
          400: '#b2e16e',
          500: '#96ce4c',
          600: '#7bb53d',
          700: '#649934',
          800: '#507b2e',
          900: '#456829',
          950: '#355819'
        },

        fuchsia: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e'
        },

        orange: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fedbb8',
          300: '#fbd38d',
          400: '#f6ad55',
          500: '#ed8936',
          600: '#dd6b20',
          700: '#c05621',
          800: '#9c4221',
          900: '#7b341e',
          950: '#431407'
        }
      },

      textColor: {
        muted: 'var(--p-text-muted-color)'
      }
    }
  },

  plugins: []
}
