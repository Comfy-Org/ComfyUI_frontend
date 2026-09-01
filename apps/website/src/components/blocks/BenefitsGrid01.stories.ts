import type { Meta, StoryObj } from '@storybook/vue3-vite'

import BenefitsGrid01 from './BenefitsGrid01.vue'

const meta: Meta<typeof BenefitsGrid01> = {
  title: 'Website/Blocks/BenefitsGrid01',
  component: BenefitsGrid01,
  tags: ['autodocs'],
  args: {
    heading: 'Why join the program',
    benefits: [
      { id: 'reach', description: 'Reach a global audience of builders.' },
      { id: 'earn', description: 'Earn recurring commission on referrals.' },
      { id: 'assets', description: 'Get ready-made creative assets.' },
      { id: 'support', description: 'Dedicated partner support at every step.' }
    ],
    primaryCta: { label: 'Apply now', href: '#' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithTitlesAndFootnote: Story = {
  args: {
    heading: 'How it works',
    benefits: [
      {
        id: 'validate',
        title: 'Validate',
        description: 'We prove the outcome is achievable on your own material.'
      },
      {
        id: 'build',
        title: 'Build',
        description:
          'We build the workflow inside your environment, on your models and infrastructure.'
      },
      {
        id: 'enable',
        title: 'Enable',
        description:
          'We train your team to run, modify, and extend it themselves.'
      },
      {
        id: 'own',
        title: 'Own',
        description:
          'It runs on your infrastructure, and your team can change it without us.'
      }
    ],
    footnote: "The direct line stays open. We're here when your team needs us.",
    primaryCta: undefined
  }
}

export const WithTitlesFootnoteAndAction: Story = {
  args: {
    ...WithTitlesAndFootnote.args,
    primaryCta: {
      label: 'VIEW DETAILS',
      href: '#'
    }
  }
}

export const WithTitlesFootnoteAndActionTablet: Story = {
  ...WithTitlesFootnoteAndAction,
  globals: {
    viewport: { value: 'tablet', isRotated: false }
  }
}

export const WithTitlesFootnoteAndActionMobile: Story = {
  ...WithTitlesFootnoteAndAction,
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
