import type { Meta, StoryObj } from '@storybook/vue3-vite'

import StepsCards01 from './StepsCards01.vue'

const meta: Meta<typeof StepsCards01> = {
  title: 'Website/Blocks/StepsCards01',
  component: StepsCards01,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink"><story /></div>'
    })
  ],
  parameters: {
    layout: 'fullscreen'
  },
  args: {
    heading: 'From one working setup to an approved fleet.',
    steps: [
      {
        id: 'define',
        title: 'Define the build',
        description:
          'Start from a known-good environment or import a snapshot of a setup you already run.'
      },
      {
        id: 'build',
        title: 'Build it once',
        description:
          'Pin the ComfyUI release, Python and CUDA versions, custom nodes, models, and dependencies.'
      },
      {
        id: 'update',
        title: 'Update deliberately',
        description:
          'Cut a new version when you decide. Move the team together without changing work already in flight.'
      },
      {
        id: 'deploy',
        title: 'Roll out to the fleet',
        description:
          'Assign the build through Comfy Desktop or your GPU servers. Deploy endpoints through the Developer Platform.'
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
