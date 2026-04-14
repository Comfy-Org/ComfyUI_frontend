import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ReasonSection from './ReasonSection.vue'

const meta: Meta<typeof ReasonSection> = {
  title: 'Website/Product/ReasonSection',
  component: ReasonSection,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ],
  args: {
    heading: 'Why professionals\nchoose ',
    headingHighlight: 'Comfy Local',
    reasons: [
      {
        title: 'Unlimited\ncreative power',
        description:
          'Run any workflow without limits. No queues, no credits, no restrictions on what you can create.'
      },
      {
        title: 'Any model,\nany time',
        description:
          'Use any open-source model instantly. Switch between Stable Diffusion, Flux, and more with a single click.'
      },
      {
        title: 'Your machine,\nyour rules',
        description:
          'Your data never leaves your computer. Full privacy and complete control over your creative environment.'
      },
      {
        title: 'Free.\nOpen Source.',
        description:
          'No subscriptions, no hidden fees. ComfyUI is and always will be free and open source.'
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutHighlight: Story = {
  args: {
    heading: 'Why choose Comfy',
    headingHighlight: '',
    reasons: [
      {
        title: 'Fast',
        description: 'Optimized for speed and efficiency.'
      },
      {
        title: 'Flexible',
        description: 'Adapt to any workflow with ease.'
      }
    ]
  }
}
