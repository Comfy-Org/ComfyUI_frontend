import type { Meta, StoryObj } from '@storybook/vue3-vite'

import HeroWaitlist01 from './HeroWaitlist01.vue'

const meta: Meta<typeof HeroWaitlist01> = {
  title: 'Website/Blocks/HeroWaitlist01',
  component: HeroWaitlist01,
  tags: ['autodocs'],
  args: {
    badgeText: 'AGENT',
    title: 'The first agent for craft',
    subtitle:
      'An agent that lives inside ComfyUI, local and cloud. Describe what you want: it builds the workflow on your canvas with you, reviews assets, runs generations, and iterates until the result is production ready.',
    footnote: "We'll prepare your account and email you when it's ready.",
    signupEvent: 'agent_beta_waitlist_joined'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoBadge: Story = {
  args: {
    badgeText: undefined
  }
}

export const TitleOnly: Story = {
  args: {
    badgeText: undefined,
    subtitle: undefined,
    footnote: undefined
  }
}

/** A second waitlist reuses the block by naming its own Customer.io event. */
export const OtherWaitlist: Story = {
  args: {
    badgeText: 'CLOUD',
    title: 'Early access to Comfy Cloud',
    subtitle: 'Run your workflows on our hardware, with no local setup.',
    signupEvent: 'cloud_beta_waitlist_joined'
  }
}
