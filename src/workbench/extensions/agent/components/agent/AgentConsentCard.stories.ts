import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import AgentConsentCard from '@/workbench/extensions/agent/components/agent/AgentConsentCard.vue'
import { AGENT_DOCS_URL } from '@/workbench/extensions/agent/agentDocs'

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
  parameters: { layout: 'fullscreen' },
  // The card is designed on a dark surface; default the theme toolbar to dark.
  globals: { theme: 'dark' },
  args: {
    title: enMessages.agent.consent.title,
    paragraphs,
    videoSources: VIDEO_SOURCES,
    posterSrc: POSTER_SRC,
    docsUrl: AGENT_DOCS_URL,
    requiresSignIn: false,
    accepting: false,
    error: '',
    onAccept: fn(),
    onReject: fn()
  },
  argTypes: {
    error: {
      control: 'select',
      options: ['', 'save', 'load', 'signIn']
    }
  },
  decorators: [
    () => ({
      template:
        '<div class="grid min-h-dvh place-items-center bg-background p-4"><story /></div>'
    })
  ]
}
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SignedOut: Story = {
  args: {
    requiresSignIn: true,
    paragraphs: [
      enMessages.agent.consent.body1,
      enMessages.agent.consent.body2BeforeSignIn
    ]
  }
}

export const Loading: Story = {
  args: { accepting: true }
}

export const Error: Story = {
  args: { error: 'save' }
}

export const SignInError: Story = {
  ...SignedOut,
  args: { ...SignedOut.args, error: 'signIn' }
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

const narrowPanel = () => ({
  template:
    '<div class="grid place-items-center bg-background p-8"><div class="w-[380px]"><story /></div></div>'
})

export const InNarrowPanel: Story = {
  decorators: [narrowPanel]
}

export const SignedOutInNarrowPanel: Story = {
  ...SignedOut,
  decorators: [narrowPanel]
}

export const ErrorInNarrowPanel: Story = {
  ...Error,
  decorators: [narrowPanel]
}
