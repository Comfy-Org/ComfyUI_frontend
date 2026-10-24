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
  render: (args) => ({
    components: { ReasonsSplit01 },
    setup: () => ({ args }),
    template: `
      <ReasonsSplit01 v-bind="args">
        <template #heading>
          Why teams choose <span class="text-primary-comfy-yellow">ComfyUI</span>
        </template>
      </ReasonsSplit01>
    `
  }),
  args: {
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
  render: (args) => ({
    components: { ReasonsSplit01 },
    setup: () => ({ args }),
    template: `
      <ReasonsSplit01 v-bind="args">
        <template #heading>Why teams choose ComfyUI</template>
      </ReasonsSplit01>
    `
  })
}
