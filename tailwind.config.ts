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
    })
  ]
}
