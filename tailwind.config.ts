import lucide from '@iconify-json/lucide/icons.json' with { type: 'json' }
import { addDynamicIconSelectors } from '@iconify/tailwind'

import { iconCollection } from './build/customIconCollection'

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],

  safelist: [
    'icon-[lucide--folder]',
    'icon-[lucide--package]',
    'icon-[lucide--image]',
    'icon-[lucide--video]',
    'icon-[lucide--box]',
    'icon-[lucide--audio-waveform]',
    'icon-[lucide--message-circle]'
  ],

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
