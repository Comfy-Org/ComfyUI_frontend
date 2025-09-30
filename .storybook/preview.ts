import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import { setup } from '@storybook/vue3'
import type { Preview, StoryContext, StoryFn } from '@storybook/vue3-vite'
import { createPinia } from 'pinia'
import 'primeicons/primeicons.css'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'

import '@/assets/css/style.css'
import { i18n } from '@/i18n'
import '@/lib/litegraph/public/css/litegraph.css'
import { useSettingStore } from '@/stores/settingStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const ComfyUIPreset = definePreset(Aura, {
  semantic: {
    // @ts-expect-error fix me
    primary: Aura['primitive'].blue
  }
})

// Setup Vue app for Storybook
setup((app) => {
  app.directive('tooltip', Tooltip)

  // Create Pinia instance
  const pinia = createPinia()

  app.use(pinia)

  // Initialize stores
  useColorPaletteStore(pinia)
  useWidgetStore(pinia)

  // Initialize setting store and mock settings for Storybook
  const settingStore = useSettingStore(pinia)

  // Initialize setting values manually for Storybook (since loadSettingValues might fail)
  settingStore.$patch({
    settingValues: {} // Start with empty settings values
  })

  // Mock common setting definitions for Storybook
  const mockSettings = [
    { id: 'Comfy.Locale', name: 'Language', type: 'combo', defaultValue: 'en' },
    {
      id: 'Comfy.AutoSave',
      name: 'Auto Save',
      type: 'boolean',
      defaultValue: true
    },
    {
      id: 'Comfy.AutoSaveInterval',
      name: 'Auto Save Interval',
      type: 'number',
      defaultValue: 30
    },
    {
      id: 'Comfy.ColorPalette',
      name: 'Color Palette',
      type: 'combo',
      defaultValue: 'dark'
    },
    {
      id: 'Comfy.AccentColor',
      name: 'Accent Color',
      type: 'color',
      defaultValue: '#007bff'
    },
    {
      id: 'Comfy.NodeOpacity',
      name: 'Node Opacity',
      type: 'slider',
      defaultValue: 80
    },
    {
      id: 'Comfy.MaxConcurrentTasks',
      name: 'Max Concurrent Tasks',
      type: 'number',
      defaultValue: 4
    },
    {
      id: 'Comfy.EnableGPUAcceleration',
      name: 'GPU Acceleration',
      type: 'boolean',
      defaultValue: true
    },
    {
      id: 'Comfy.CacheSize',
      name: 'Cache Size',
      type: 'slider',
      defaultValue: 512
    },
    // Mock settings used in stories
    {
      id: 'test.setting',
      name: 'Test Setting',
      type: 'boolean',
      defaultValue: false
    },
    {
      id: 'mixed.boolean',
      name: 'Boolean Setting',
      type: 'boolean',
      defaultValue: true
    },
    {
      id: 'mixed.text',
      name: 'Text Setting',
      type: 'text',
      defaultValue: 'Default text'
    },
    {
      id: 'mixed.number',
      name: 'Number Setting',
      type: 'number',
      defaultValue: 42
    },
    {
      id: 'mixed.slider',
      name: 'Slider Setting',
      type: 'slider',
      defaultValue: 75
    },
    {
      id: 'mixed.combo',
      name: 'Combo Setting',
      type: 'combo',
      defaultValue: 'option2'
    },
    {
      id: 'mixed.color',
      name: 'Color Setting',
      type: 'color',
      defaultValue: '#ff6b35'
    }
  ]

  // Register mock settings
  try {
    mockSettings.forEach((setting) => settingStore.addSetting(setting as any))
  } catch (error) {
    console.warn('Failed to add settings, they might already exist:', error)
  }

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

// Theme and dialog decorator
export const withTheme = (Story: StoryFn, context: StoryContext) => {
  const theme = context.globals.theme || 'light'

  // Apply theme class to document root
  if (theme === 'dark') {
    document.documentElement.classList.add('dark-theme')
    document.body.classList.add('dark-theme')
  } else {
    document.documentElement.classList.remove('dark-theme')
    document.body.classList.remove('dark-theme')
  }

  return Story(context.args, context)
}

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
        { name: 'dark', value: '#0a0a0a' }
      ]
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
        showName: true,
        dynamicTitle: true
      }
    }
  },
  decorators: [withTheme]
}

export default preview
