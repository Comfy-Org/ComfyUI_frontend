import { setup } from '@storybook/vue3'
import type { Preview } from '@storybook/vue3-vite'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createI18n } from 'vue-i18n'

import '../public/materialdesignicons.min.css'
// Import styles
import '../src/assets/css/style.css'

// Mock Firebase for Storybook
const mockFirebase = {
  auth: () => ({
    currentUser: null,
    onAuthStateChanged: () => () => {}
  }),
  firestore: () => ({})
}

// Setup Vue plugins for Storybook
setup((app) => {
  const pinia = createPinia()
  const i18n = createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
      en: {
        g: {
          searchSettings: 'Search Settings',
          noResultsFound: 'No Results Found',
          searchFailedMessage: 'Try adjusting your search terms',
          experimental: 'Experimental',
          loadingPanel: 'Loading {panel}...'
        },
        settings: {},
        settingsCategories: {}
      }
    }
  })

  app.use(pinia)
  app.use(i18n)
  app.use(PrimeVue, {
    theme: {
      preset: null // Will use CSS for theming
    }
  })
  app.use(ToastService)
  app.directive('tooltip', Tooltip)

  // Provide mock services
  app.provide('firebase', mockFirebase)
})

// Dark theme decorator
export const withTheme = (Story: any, context: any) => {
  const theme = context.globals.theme || 'light'

  // Apply theme class to document root
  if (theme === 'dark') {
    document.documentElement.classList.add('dark-theme')
    document.body.classList.add('dark-theme')
  } else {
    document.documentElement.classList.remove('dark-theme')
    document.body.classList.remove('dark-theme')
  }

  return Story()
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
        {
          name: 'light',
          value: '#ffffff'
        },
        {
          name: 'dark',
          value: '#1a1a1a'
        }
      ]
    },
    viewport: {
      viewports: {
        small: {
          name: 'Small',
          styles: {
            width: '640px',
            height: '480px'
          }
        },
        medium: {
          name: 'Medium',
          styles: {
            width: '768px',
            height: '1024px'
          }
        },
        large: {
          name: 'Large',
          styles: {
            width: '1024px',
            height: '768px'
          }
        }
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
        showName: true,
        dynamicTitle: true
      }
    }
  },
  decorators: [withTheme]
}

export default preview
