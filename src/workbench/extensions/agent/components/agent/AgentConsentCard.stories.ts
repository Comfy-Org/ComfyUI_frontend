import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AgentConsentCard from '@/workbench/extensions/agent/components/agent/AgentConsentCard.vue'

const VIDEO_SRC = 'https://media.comfy.org/website/mcp/launch-film.mp4'

const paragraphs = [
  'The agent can read your workflow, add and edit nodes, and run the graph on your behalf. It only acts on the workflow you have open.',
  'You can revoke access at any time from settings. Nothing is shared until you accept.'
]

const meta: Meta<typeof AgentConsentCard> = {
  title: 'Agent/ConsentCard',
  component: AgentConsentCard,
  tags: ['autodocs'],
  // The card is designed on a dark surface; default the theme toolbar to dark.
  globals: { theme: 'dark' },
  args: {
    title: 'Let the agent work in your workflow',
    paragraphs,
    videoSrc: VIDEO_SRC,
    docsUrl: 'https://docs.comfy.org/agent-tools/in-app-agent'
  },
  decorators: [
    () => ({
      template:
        '<div class="grid min-h-screen place-items-center bg-base-background p-8"><story /></div>'
    })
  ]
}
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutVideo: Story = {
  args: { videoSrc: '' }
}

export const SingleParagraph: Story = {
  args: { paragraphs: [paragraphs[0]] }
}

export const LongCopy: Story = {
  args: {
    title:
      'Let the agent read, edit, and run the workflow you currently have open',
    paragraphs: [
      ...paragraphs,
      'Generations started by the agent consume credits in the same way as generations you start yourself, and appear in the same job queue.'
    ]
  }
}

/**
 * The card responds to its container, not the viewport, so it stacks inside a
 * narrow agent panel even on a wide screen.
 */
export const InNarrowPanel: Story = {
  decorators: [
    () => ({
      template:
        '<div class="grid min-h-screen place-items-center bg-base-background p-8"><div class="w-[380px]"><story /></div></div>'
    })
  ]
}
