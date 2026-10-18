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
  argTypes: {
    layout: { control: 'select', options: ['grid', 'timeline'] }
  },
  args: {
    heading: 'From prompt to production',
    layout: 'grid',
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

export const Timeline: Story = {
  args: {
    heading: 'Timeline',
    layout: 'timeline',
    highlightedId: 'build',
    steps: [
      {
        id: 'signup',
        title: 'Signups open',
        label: '10/15',
        description: 'Registration opens for the online competition.'
      },
      {
        id: 'build',
        title: 'Build',
        label: '10/15 – 10/30',
        description: 'Submission window closes: October 30 · 9am PT.'
      },
      {
        id: 'nights',
        title: 'Build Nights',
        label: '10/28 – 11/3',
        description: 'SF 10/28 · LA 10/29 · NYC 11/3.'
      },
      {
        id: 'winner',
        title: 'Winners announced',
        label: '11/6',
        description:
          'Winning entries are featured on comfy.org/hub with credit.'
      }
    ]
  }
}
