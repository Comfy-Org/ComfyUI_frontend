import type { Preview } from '@storybook/vue3-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import '@/styles/global.css'

document.body.classList.add('font-formula', 'antialiased')

const preview: Preview = {
  tags: ['stable'],
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
      test: 'todo'
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
      default: 'website',
      values: [
        { name: 'website', value: '#211927' },
        { name: 'light', value: '#f0efed' }
      ]
    }
  }
}

export default preview
