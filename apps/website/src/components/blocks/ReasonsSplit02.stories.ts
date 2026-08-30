import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ReasonsSplit02 from './ReasonsSplit02.vue'

const meta: Meta<typeof ReasonsSplit02> = {
  title: 'Website/Blocks/ReasonsSplit02',
  component: ReasonsSplit02,
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
    heading: 'How it works',
    lead: 'Four moving parts. A Distribution freezes your environment. A Deployment runs it on serverless GPUs and gives you a URL. The SDK is how your app calls that URL.',
    reasons: [
      {
        id: 'workflow',
        number: '1',
        title: 'Workflow',
        description: 'Your ComfyUI graph, exported in API format'
      },
      {
        id: 'builds',
        number: '2',
        title: 'Managed Builds',
        description: 'A reproducible environment: version + models + nodes.'
      },
      {
        id: 'deployment',
        number: '3',
        title: 'Deployment',
        description: 'That environment on autoscaling GPUs, with a URL.'
      },
      {
        id: 'sdk',
        number: '4',
        title: 'Comfy SDK',
        description: 'Your app submits, polls, and gets outputs.',
        link: { label: 'Try SDK', href: '#' }
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

/** The /developers "How it works" shape: side heading, numerals, a row link. */
export const NumberedSideHeading: Story = {}

/** The /developers "Same build, anywhere" shape: heading above plain rows. */
export const HeadingTop: Story = {
  args: {
    heading: 'Same build, anywhere',
    lead: undefined,
    headingPosition: 'top',
    reasons: [
      {
        id: 'builds',
        title: 'Stop managing builds',
        description:
          'Custom nodes installed correctly, checkpoints in the right place, Python dependencies you can still customize. The Builder Agent fixes builds that break.'
      },
      {
        id: 'deploy',
        title: 'Build once, deploy anywhere',
        description:
          'Local GPU workstations, server deployments, the serverless API. One build, different targets.'
      },
      {
        id: 'scale',
        title: 'Scale from zero',
        description:
          'The serverless API scales up and down with traffic. Configure your tolerance for cold starts and pick your GPU.'
      }
    ]
  }
}

/** Side heading without numerals — plain rows keep the tighter rhythm. */
export const PlainSideHeading: Story = {
  args: {
    reasons: [
      {
        id: 'workflow',
        title: 'Workflow',
        description: 'Your ComfyUI graph, exported in API format'
      },
      {
        id: 'builds',
        title: 'Managed Builds',
        description: 'A reproducible environment: version + models + nodes.'
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
