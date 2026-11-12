import { setup } from '@storybook/vue3'
import type { Preview, StoryContext, StoryFn } from '@storybook/vue3-vite'
import { createPinia } from 'pinia'
import 'primeicons/primeicons.css'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import {
  DEFAULT_THEME_PRESET,
  DEFAULT_DARK_THEME_PRESET,
  DEFAULT_LIGHT_THEME_PRESET
} from '@comfyorg/theme-core/builtInThemePresets'
import { i18n } from '@/i18n'
import { resolveTheme } from '@comfyorg/theme-core/resolveTheme'
import { applyTheme } from '@/platform/theme/applyTheme'
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
    context.globals.theme === 'light'
      ? DEFAULT_LIGHT_THEME_PRESET
      : DEFAULT_DARK_THEME_PRESET
  applyTheme(resolveTheme(palette), { style: document.documentElement.style })

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
  initialGlobals: {
    theme: DEFAULT_THEME_PRESET.id
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
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
