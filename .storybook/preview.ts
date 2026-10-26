import { setup } from '@storybook/vue3'
import type { Preview, StoryContext, StoryFn } from '@storybook/vue3-vite'
import { createPinia } from 'pinia'
import 'primeicons/primeicons.css'

import TooltipProvider from '@/components/ui/tooltip/TooltipProvider.vue'
import {
  DEFAULT_DARK_COLOR_PALETTE,
  DEFAULT_LIGHT_COLOR_PALETTE
} from '@/constants/coreColorPalettes'
import { i18n } from '@/i18n'
import { applyPaletteTheme } from '@/utils/colorPaletteTheme'
import '@/lib/litegraph/public/css/litegraph.css'
import '@/assets/css/style.css'

// Setup Vue app for Storybook
setup((app) => {
  // Create Pinia instance
  const pinia = createPinia()

  app.use(pinia)
  app.use(i18n)
})

export const withTheme = (Story: StoryFn, context: StoryContext) => {
  const palette =
    context.globals.theme === 'dark'
      ? DEFAULT_DARK_COLOR_PALETTE
      : DEFAULT_LIGHT_COLOR_PALETTE
  applyPaletteTheme(document.documentElement.style, palette)
  document.body.classList.add('font-inter')

  return Story(context.args, context)
}

function withTooltipProvider() {
  return {
    components: { TooltipProvider },
    template: '<TooltipProvider><story /></TooltipProvider>'
  }
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' }
        ],
        dynamicTitle: true
      }
    }
  },
  decorators: [withTheme, withTooltipProvider]
}

export default preview
