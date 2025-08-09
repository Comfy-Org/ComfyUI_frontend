import { setup } from '@storybook/vue3'
import type { Preview } from '@storybook/vue3-vite'
import { createPinia } from 'pinia'

// Setup Vue app for Storybook
setup((app) => {
  // Add Pinia store
  app.use(createPinia())
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
