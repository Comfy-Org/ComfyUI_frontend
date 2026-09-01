import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CtaCenter01 from './CtaCenter01.vue'

const meta: Meta<typeof CtaCenter01> = {
  title: 'Website/Blocks/CtaCenter01',
  component: CtaCenter01,
  tags: ['autodocs'],
  args: {
    heading: 'Build the next generation of creative tools',
    subtitle:
      'Start locally, move to the cloud, and keep complete control of every workflow.',
    primaryCta: { label: 'GET STARTED', href: '/download/' },
    secondaryCta: {
      label: 'VIEW DOCUMENTATION',
      href: 'https://docs.comfy.org/'
    },
    termsLink: { label: 'View usage terms', href: '#' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const PrimaryOnly: Story = {
  args: {
    secondaryCta: undefined,
    termsLink: undefined
  }
}

export const HeadingAndAction: Story = {
  args: {
    subtitle: undefined,
    secondaryCta: undefined,
    termsLink: undefined
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
