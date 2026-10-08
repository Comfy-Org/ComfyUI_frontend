import type { Meta, StoryObj } from '@storybook/vue3-vite'

import StepsGrid01 from './StepsGrid01.vue'

const meta: Meta<typeof StepsGrid01> = {
  title: 'Website/Blocks/StepsGrid01',
  component: StepsGrid01,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink"><story /></div>'
    })
  ],
  args: {
    heading: 'From prompt to production',
    steps: [
      {
        id: 'install',
        label: 'Install',
        description: 'Choose Comfy Desktop, Cloud, or your own deployment.'
      },
      {
        id: 'build',
        label: 'Build',
        description: 'Connect models and operations in a visual workflow.'
      },
      {
        id: 'iterate',
        label: 'Iterate',
        description: 'Refine inputs and parameters while preserving the graph.'
      },
      {
        id: 'share',
        label: 'Share',
        description: 'Package the workflow for collaborators and production.'
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const EvenStepCount: Story = {}

export const OddStepCount: Story = {
  args: {
    steps: [
      ...(meta.args?.steps ?? []),
      {
        id: 'scale',
        label: 'Scale',
        description: 'Run the same governed workflow wherever it is needed.'
      }
    ]
  }
}
