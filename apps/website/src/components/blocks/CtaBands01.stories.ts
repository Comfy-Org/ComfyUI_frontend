import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CtaBands01 from './CtaBands01.vue'

const meta: Meta<typeof CtaBands01> = {
  title: 'Website/Blocks/CtaBands01',
  component: CtaBands01,
  tags: ['autodocs'],
  args: {
    bands: [
      {
        id: 'enterprise',
        label: 'For Enterprise',
        text: "Tell us what you're trying to make. An FDCT validates it after the first call and builds from there.",
        cta: { label: 'Contact us', href: '/contact' }
      },
      {
        id: 'creators',
        label: 'For Creators',
        text: "Building production-grade content with Comfy? We're hiring from the community.",
        cta: { label: 'Apply now', href: '/careers' }
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SingleBand: Story = {
  args: {
    bands: [
      {
        id: 'enterprise',
        label: 'For Enterprise',
        text: "Tell us what you're trying to make. An FDCT validates it after the first call and builds from there.",
        cta: { label: 'Contact us', href: '/contact' }
      }
    ]
  }
}

export const ExternalCta: Story = {
  args: {
    bands: [
      {
        id: 'community',
        label: 'For the Community',
        text: 'Share what you build and see what everyone else is making.',
        cta: {
          label: 'Join the Discord',
          href: 'https://discord.gg/comfyui',
          target: '_blank'
        }
      }
    ]
  }
}
