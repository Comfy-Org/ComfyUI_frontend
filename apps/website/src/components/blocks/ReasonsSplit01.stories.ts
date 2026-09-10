import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ReasonsSplit01 from './ReasonsSplit01.vue'

const meta: Meta<typeof ReasonsSplit01> = {
  title: 'Website/Blocks/ReasonsSplit01',
  component: ReasonsSplit01,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink"><story /></div>'
    })
  ],
  args: {
    heading: 'Why teams choose ',
    headingHighlight: 'ComfyUI',
    highlightClass: 'text-primary-comfy-yellow',
    subtitle: 'A flexible foundation for production-grade visual AI.',
    reasons: [
      {
        id: 'control',
        title: 'Complete control',
        description:
          'Inspect every step, tune every parameter, and preserve the process behind each result.'
      },
      {
        id: 'reuse',
        title: 'Reusable systems',
        description:
          'Turn successful experiments into workflows that teammates can run and improve.'
      },
      {
        id: 'ecosystem',
        title: 'Open ecosystem',
        description:
          'Use the models and custom nodes that fit your work instead of one fixed stack.'
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutHighlight: Story = {
  args: {
    heading: 'Why teams choose ComfyUI',
    headingHighlight: undefined
  }
}
