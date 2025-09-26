import { default as baseConfig } from '@comfyorg/design-system/tailwind-config'
import { addDynamicIconSelectors } from '@iconify/tailwind'

import { iconCollection } from './build/customIconCollection'

export default {
  ...baseConfig,
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  plugins: [
    ...(baseConfig.plugins || []),
    // Add app-specific comfy icons on top of the base config (which has lucide)
    addDynamicIconSelectors({
      iconSets: {
        comfy: iconCollection
      },
      prefix: 'icon'
    })
  ]
}
