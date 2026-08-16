import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ChecklistSplit01 from './ChecklistSplit01.vue'

const meta: Meta<typeof ChecklistSplit01> = {
  title: 'Website/Blocks/ChecklistSplit01',
  component: ChecklistSplit01,
  tags: ['autodocs'],
  args: {
    heading: 'Who this is for',
    subheading: 'Teams shipping production creative work',
    eyebrow: 'YOU QUALIFY IF',
    criteria: [
      { id: 'studio', label: 'You run an in-house creative or VFX team.' },
      { id: 'volume', label: 'You ship content at production volume.' },
      { id: 'infra', label: 'You have your own models and infrastructure.' }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutHeading: Story = {
  args: {
    heading: undefined,
    eyebrow: undefined,
    subheading: 'What you will get',
    criteria: [
      {
        id: 'validation',
        label: 'Use-case validation and a proof-of-concept build'
      },
      {
        id: 'workflow',
        label: 'A production-grade workflow, built and installed'
      },
      {
        id: 'enablement',
        label: 'Enablement until your team is self-sufficient'
      },
      {
        id: 'access',
        label: 'White-glove access under your enterprise agreement'
      },
      { id: 'assets', label: 'Reusable creative assets your team keeps' }
    ]
  }
}
