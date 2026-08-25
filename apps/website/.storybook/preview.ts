import type { Preview } from '@storybook/vue3-vite'

import '@/styles/global.css'

document.body.classList.add('font-formula', 'antialiased')

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /color$/i,
        date: /Date$/i
      }
    },
    backgrounds: {
      default: 'website',
      values: [
        { name: 'website', value: '#211927' },
        { name: 'light', value: '#f0efed' }
      ]
    }
  }
}

export default preview
