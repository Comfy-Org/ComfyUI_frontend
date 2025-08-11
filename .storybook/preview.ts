import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import { setup } from '@storybook/vue3'
import type { Preview } from '@storybook/vue3-vite'
import { createPinia } from 'pinia'
import 'primeicons/primeicons.css'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'

import '../src/assets/css/style.css'
import { i18n } from '../src/i18n'
import '../src/lib/litegraph/public/css/litegraph.css'
import { useWidgetStore } from '../src/stores/widgetStore'
import { useColorPaletteStore } from '../src/stores/workspace/colorPaletteStore'

const ComfyUIPreset = definePreset(Aura, {
  semantic: {
    primary: Aura['primitive'].blue
  }
})

// Setup Vue app for Storybook
setup((app) => {
  app.directive('tooltip', Tooltip)
  const pinia = createPinia()
  app.use(pinia)

  // Initialize stores
  const colorPaletteStore = useColorPaletteStore(pinia)
  const widgetStore = useWidgetStore(pinia)

  app.use(i18n)
  app.use(PrimeVue, {
    theme: {
      preset: ComfyUIPreset,
      options: {
        prefix: 'p',
        cssLayer: {
          name: 'primevue',
          order: 'primevue, tailwind-utilities'
        },
        darkModeSelector: '.dark-theme, :root:has(.dark-theme)'
      }
    }
  })
  app.use(ConfirmationService)
  app.use(ToastService)
})

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a1a' }
      ]
    }
  }
}

export default preview
