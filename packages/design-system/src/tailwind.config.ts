import lucide from '@iconify-json/lucide/icons.json' with { type: 'json' }
import { addDynamicIconSelectors } from '@iconify/tailwind'

export default {
  content: [],

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
        lucide
      },
      prefix: 'icon'
    })
  ]
}
