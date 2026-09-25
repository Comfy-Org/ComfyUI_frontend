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

export const WithTitlesFootnoteAndTwoActions: Story = {
  args: {
    ...WithTitlesAndFootnote.args,
    primaryCta: {
      label: 'VIEW DETAILS',
      href: '#'
    },
    secondaryCta: {
      label: 'REQUEST DEMO',
      href: '#'
    }
  }
}

export const TwoColumnsUnnumbered: Story = {
  args: {
    heading: 'Ready for your security review',
    columns: 2,
    numbered: false,
    benefits: [
      {
        id: 'local',
        title: 'Workflows stay local',
        description:
          'For local deployments, your Comfy Workflows and outputs stay where they run. Comfy does not train on customer data.'
      },
      {
        id: 'private-assets',
        title: 'Private models and nodes',
        description:
          'Include internal node packs and fine-tuned models inside a team-controlled build.'
      },
      {
        id: 'access',
        title: 'Identity and BYOK',
        description:
          'Gate build assignment through company identity and use supported provider keys with existing contracts.'
      },
      {
        id: 'usage',
        title: 'Audit requirements',
        description:
          'Define the model, partner, authentication, release, retention, and export events your organization needs.'
      }
    ],
    footnote:
      'DPA and enterprise agreement available. US processing on Google Cloud. 99.5% workflow-execution uptime SLA. SOC 2 Type II audit in progress.',
    primaryCta: { label: 'VIEW TRUST CENTER', href: '#' },
    secondaryCta: { label: 'REQUEST DEMO', href: '#' }
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
