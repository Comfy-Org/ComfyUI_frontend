import type { Meta, StoryObj } from '@storybook/vue3-vite'

import FAQSplit02 from './FAQSplit02.vue'

const meta: Meta<typeof FAQSplit02> = {
  title: 'Website/Blocks/FAQSplit02',
  component: FAQSplit02,
  tags: ['autodocs'],
  decorators: [
    () => ({
      // The block reads the page tokens, so it needs the subbrand scope the
      // /developers layout stamps on its page wrapper.
      template:
        '<div data-page-theme="subbrand" class="bg-page-bg py-8"><story /></div>'
    })
  ],
  args: {
    heading: 'Q&As',
    faqs: [
      {
        id: '1',
        question: 'What is the Comfy Developer Platform?',
        answer:
          'For Claude Code, Claude Desktop, or Codex, add https://cloud.comfy.org/mcp as a custom connector or remote MCP server in any client, then sign in when prompted. For any other agents, you need to connect with an API key. Send the docs https://docs.comfy.org/agent-tools/cloud to your agent and it will figure out the installation for you.'
      },
      {
        id: '2',
        question: 'Can I call a ComfyUI workflow as an API from my own app?',
        answer:
          'Yes. Export the workflow in API format, deploy it, and call the deployment URL from the SDK.'
      },
      {
        id: '3',
        question: 'Do I have to rewrite my workflow to deploy it?',
        answer: 'No. The graph that runs on your machine is the graph we run.'
      },
      {
        id: '4',
        question:
          'What happens when custom nodes have conflicting Python dependencies?',
        answer:
          'Managed Builds pin the environment, and the Builder Agent resolves conflicts before the build ships.'
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

/** The /developers shape: first answer expanded, links inside it. */
export const Default: Story = {}

/** Nothing expanded on load — pass an empty list to override the default. */
export const AllCollapsed: Story = { args: { defaultOpen: [] } }

/** Markdown link syntax renders as anchor text instead of a bare URL. */
export const LabelledLinks: Story = {
  args: {
    faqs: [
      {
        id: '1',
        question: 'Where do I find the SDK docs?',
        answer:
          'Everything lives in [the developer docs](https://docs.comfy.org), including the quickstart.'
      }
    ]
  }
}

/** A long question wraps to two lines and the toggle stays centred. */
export const LongQuestion: Story = {
  args: {
    defaultOpen: [],
    faqs: [
      {
        id: '1',
        question:
          'How is this different from running ComfyUI on RunPod or Modal myself?',
        answer: 'You keep the workflow; we keep the build reproducible.'
      }
    ]
  }
}

/** On a dark page the same tokens resolve to the site's default palette. */
export const DarkSurface: Story = {
  decorators: [
    () => ({
      template: '<div class="bg-page-bg py-8"><story /></div>'
    })
  ]
}
