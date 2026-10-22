import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'

import PrizeTiers01 from './PrizeTiers01.vue'

const meta: Meta<typeof PrizeTiers01> = {
  title: 'Website/Blocks/PrizeTiers01',
  component: PrizeTiers01,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink"><story /></div>'
    })
  ],
  parameters: {
    layout: 'fullscreen'
  },
  args: {
    heading: 'Prizes & Categories',
    mainLabel: 'Main prizes',
    grand: {
      id: 'best-overall',
      title: 'Best Overall',
      award: '$10,000',
      description:
        'Best overall build. Every entry is automatically considered.'
    },
    categories: [
      {
        id: 'most-innovative',
        title: 'Most Innovative',
        award: 'GeForce RTX 5090',
        description:
          "An app that's never been done, novel custom node packs or uses of ComfyUI. Demo video must explain why the submission is innovative."
      },
      {
        id: 'most-viral',
        title: 'Most Viral',
        award: 'GeForce RTX 5090',
        description: 'Delightful to use and made to be shared.'
      },
      {
        id: 'open-weights-only',
        title: 'Open Weights Only',
        award: 'GeForce RTX 5090',
        description: 'No partner nodes or APIs, open-weights models only.'
      }
    ],
    runnerUp: {
      id: 'runner-ups',
      title: '10 Runner Ups',
      award: '$250 in Comfy Credits'
    },
    bonusLabel: 'OSS Ecosystem Bonuses',
    bonuses: [
      {
        id: 'vfx-ltx',
        title: 'VFX Workflow Built with LTX',
        award: '$2,000 cash',
        description:
          'LTX must be the core video model in the workflow to qualify.'
      },
      {
        id: 'built-with-flux',
        title: 'Built with FLUX',
        award: '$1,000 / $500 / $250 in Flux API credits',
        description:
          'FLUX3 must be the core video model in the workflow to qualify.'
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithCallToAction: Story = {
  render: (args) => ({
    components: { Button, PrizeTiers01 },
    setup() {
      return { args }
    },
    template: `
      <PrizeTiers01 v-bind="args">
        <Button href="#submit">Submit your entry</Button>
        <Button href="#terms" variant="outline">Terms</Button>
      </PrizeTiers01>
    `
  })
}
