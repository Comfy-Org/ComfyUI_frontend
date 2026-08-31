import type { Meta, StoryObj } from '@storybook/vue3-vite'

import HeroProduct01 from './HeroProduct01.vue'

const meta: Meta<typeof HeroProduct01> = {
  title: 'Website/Blocks/HeroProduct01',
  component: HeroProduct01,
  tags: ['autodocs'],
  args: {
    title: 'MANAGED BUILDS',
    tag: 'BETA',
    body: 'Govern the models, custom nodes, and dependencies your team runs. Create a managed distribution of ComfyUI and deploy the same build anywhere, local or serverless cloud.',
    primaryCta: { label: 'CONTACT SALES', href: '#' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutTag: Story = {
  args: { tag: undefined }
}

export const WithSecondaryCta: Story = {
  args: {
    secondaryCta: { label: 'SEE HOW IT WORKS', href: '#how-it-works' }
  }
}

export const AsSecondaryHeading: Story = {
  args: { headingTag: 'h2' }
}
