import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CompareCards01 from './CompareCards01.vue'

const meta: Meta<typeof CompareCards01> = {
  title: 'Website/Blocks/CompareCards01',
  component: CompareCards01,
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
    heading: 'The problem this solves',
    lead: 'Custom nodes installed in the right order. Checkpoints in the right folders. Python dependencies that only work on one machine. A box someone keeps warm.',
    cards: [
      {
        label: 'Today',
        body: 'A workflow that runs on one workstation. Custom nodes installed by hand, checkpoints in folders someone remembers, Python dependencies that break when anything moves. To run it anywhere else, you rebuild it — and to keep it available, someone keeps a box warm.'
      },
      {
        label: 'With the platform',
        body: 'The same build, deployed. Nodes, models, and dependencies resolved once and carried with it. Run it locally, on a server, or as a serverless endpoint that scales with traffic and drops to zero when nothing is running.'
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutLead: Story = { args: { lead: undefined } }

export const ThreeCards: Story = {
  args: {
    heading: 'Three ways to run it',
    cards: [
      { label: 'Local', body: 'Runs on the workstation in front of you.' },
      { label: 'Cloud', body: 'The same build on managed hardware.' },
      {
        label: 'Serverless',
        body: 'Scales with traffic and drops to zero when nothing is running.'
      }
    ]
  }
}
