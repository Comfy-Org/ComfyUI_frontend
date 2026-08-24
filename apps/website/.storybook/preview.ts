import type { Preview } from '@storybook/vue3-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import '@/styles/global.css'

document.body.classList.add('font-formula', 'antialiased')

const preview: Preview = {
  tags: ['stable'],
  initialGlobals: {
    backgrounds: { value: 'dark' }
  },
  decorators: [
    (_, context) => ({
      template: `<div class="min-h-screen ${context.globals.backgrounds?.value === 'light' ? 'bg-primary-warm-white' : 'bg-primary-comfy-ink'}"><story /></div>`
    })
  ],
  parameters: {
    layout: 'fullscreen',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/design/11vkE4FAn4plEYpawd57zS/Comfy----Website-Design?node-id=1-9'
    },
    controls: {
      matchers: {
        color: /color$/i,
        date: /Date$/i
      }
    },
    a11y: {
      test: 'error',
      config: {
        rules: [{ id: 'color-contrast', enabled: false }]
      }
    },
    viewport: {
      options: INITIAL_VIEWPORTS
    },
    options: {
      storySort: {
        order: [
          'Website',
          [
            'Start Here',
            'Foundations',
            'UI',
            'Common',
            'Blocks',
            'Product',
            'Compositions'
          ]
        ]
      }
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#211927' },
        { name: 'light', value: '#f0efed' }
      ]
    }
  }
}

export default preview
