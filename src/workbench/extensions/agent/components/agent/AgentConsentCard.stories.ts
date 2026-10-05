import type { Meta, StoryObj } from '@storybook/vue3-vite'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import AgentConsentCard from '@/workbench/extensions/agent/components/agent/AgentConsentCard.vue'

const MEDIA_BASE = 'https://media.comfy.org/website/comfy-agent'
const VIDEO_SOURCES = [
  { src: `${MEDIA_BASE}/agent-consent-v2-1280.webm`, type: 'video/webm' },
  { src: `${MEDIA_BASE}/agent-consent-v2-1280.mp4`, type: 'video/mp4' }
]
const POSTER_SRC = `${MEDIA_BASE}/agent-consent-v2-poster.jpg`

const paragraphs = [
  enMessages.agent.consent.body1,
  enMessages.agent.consent.body2
]

const meta: Meta<typeof AgentConsentCard> = {
  title: 'Agent/ConsentCard',
  component: AgentConsentCard,
  tags: ['autodocs'],
  // The card is designed on a dark surface; default the theme toolbar to dark.
  globals: { theme: 'dark' },
  args: {
    title: enMessages.agent.consent.title,
    paragraphs,
    videoSources: VIDEO_SOURCES,
    posterSrc: POSTER_SRC,
    docsUrl: 'https://docs.comfy.org/agent-tools/in-app-agent'
  },
  decorators: [
    () => ({
      template:
        '<div class="grid place-items-center bg-base-background p-8"><story /></div>'
    })
  ]
}
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = {
  args: { accepting: true }
}

export const Error: Story = {
  args: { error: enMessages.agent.consent.saveError }
}

export const InLightApp: Story = {
  globals: { theme: 'light' }
}

export const WithoutVideo: Story = {
  args: { videoSources: [] }
}

export const SingleParagraph: Story = {
  args: { paragraphs: [paragraphs[0]] }
}

export const LongCopy: Story = {
  args: { paragraphs: [...paragraphs, ...paragraphs] }
}

/**
 * The card responds to its container, not the viewport, so it stacks inside a
 * narrow agent panel even on a wide screen.
 */
export const InNarrowPanel: Story = {
  decorators: [
    () => ({
      template:
        '<div class="grid place-items-center bg-base-background p-8"><div class="w-[380px]"><story /></div></div>'
    })
  ]
}
