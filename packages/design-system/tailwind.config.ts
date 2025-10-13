import lucide from '@iconify-json/lucide/icons.json' with { type: 'json' }
import { addDynamicIconSelectors } from '@iconify/tailwind'

import { iconCollection } from './src/iconCollection'

export default {
  plugins: [
    addDynamicIconSelectors({
      iconSets: {
        comfy: iconCollection,
        lucide
      },
      scale: 1.2,
      prefix: 'icon'
    })
  ]
}
