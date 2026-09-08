import type { Meta, StoryObj } from '@storybook/vue3-vite'

import FeatureGrid02 from './FeatureGrid02.vue'

const steps = [
  {
    id: 'build',
    number: '01',
    title: 'Build',
    description: 'Compose a workflow with the models and tools you choose.'
  },
  {
    id: 'iterate',
    number: '02',
    title: 'Iterate',
    description: 'Refine parameters and compare outputs without losing context.'
  },
  {
    id: 'ship',
    number: '03',
    title: 'Ship',
    description: 'Run the same graph locally, in the cloud, or through an API.'
  }
] as const

const meta: Meta<typeof FeatureGrid02> = {
  title: 'Website/Blocks/FeatureGrid02',
  component: FeatureGrid02,
  tags: ['autodocs'],
  args: {
    heading: 'From idea to production',
    steps,
    primaryCta: { label: 'START BUILDING', href: '#' },
    secondaryCta: { label: 'READ THE DOCS', href: '#' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutActions: Story = {
  args: {
    primaryCta: undefined,
    secondaryCta: undefined
  }
}

export const TwoSteps: Story = {
  args: {
    steps: steps.slice(0, 2)
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
