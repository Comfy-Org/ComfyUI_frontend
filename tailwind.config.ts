import lucide from '@iconify-json/lucide/icons.json'
import { addDynamicIconSelectors } from '@iconify/tailwind'

import { iconCollection } from './build/customIconCollection'

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],

  plugins: [
    addDynamicIconSelectors({
      iconSets: {
        comfy: iconCollection,
        lucide
      },
      prefix: 'icon'
    }),
    function ({ addVariant }) {
      addVariant('dark-theme', '.dark-theme &')
    },
    function ({ addUtilities }) {
      const newUtilities = {
        '.scrollbar-hide': {
          /* Firefox */
          'scrollbar-width': 'none',
          /* Webkit-based browsers */
          '&::-webkit-scrollbar': {
            width: '1px'
          },
          '&::-webkit-scrollbar-thumb': {
            'background-color': 'transparent'
          }
        }
      }
      addUtilities(newUtilities)
    }
  ]
}
