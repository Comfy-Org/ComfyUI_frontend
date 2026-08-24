import type { Meta, StoryObj } from '@storybook/vue3-vite'

import FeatureRows01 from './FeatureRows01.vue'

const meta: Meta<typeof FeatureRows01> = {
  title: 'Website/Blocks/FeatureRows01',
  component: FeatureRows01,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink"><story /></div>'
    })
  ],
  args: {
    eyebrow: 'Built for every workflow',
    heading: 'Move from an idea to a repeatable creative system.',
    rows: [
      {
        id: 'compose',
        title: 'Compose visually',
        description:
          'Connect models and tools in a graph you can inspect, refine, and share.',
        media: {
          type: 'image',
          src: '/images/demos/community-workflows-thumb.webp',
          alt: 'A visual ComfyUI workflow'
        }
      },
      {
        id: 'iterate',
        title: 'Iterate with control',
        description:
          'Change one part of a workflow without rebuilding the rest of the process.',
        media: {
          type: 'image',
          src: '/images/demos/workflow-templates-thumb.webp',
          alt: 'A ComfyUI workflow template'
        }
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
