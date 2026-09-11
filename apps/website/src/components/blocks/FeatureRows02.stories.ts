import type { Meta, StoryObj } from '@storybook/vue3-vite'

import FeatureRows02 from './FeatureRows02.vue'

const meta: Meta<typeof FeatureRows02> = {
  title: 'Website/Blocks/FeatureRows02',
  component: FeatureRows02,
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
    heading: 'One ComfyUI build for the whole team',
    rows: [
      {
        id: 'packaging',
        term: 'Environment packaging',
        description:
          'Replace one-off install scripts, dependency matrices, and machine-specific fixes with one versioned build.'
      },
      {
        id: 'governance',
        term: 'Node governance',
        description:
          'ComfyUI’s ecosystem spans 5,000+ extensions and 60,000+ community nodes. Pin and approve the nodes included in each build.'
      },
      {
        id: 'rollout',
        term: 'Onboarding and rollout',
        description:
          'Assign known-good builds through company identity, onboard new teammates, and move the fleet together when a release is ready.'
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithFootnote: Story = {
  args: {
    footnote:
      'The graph stays flexible. The environment around it becomes an approved, reviewable operating model for the organization.'
  }
}
