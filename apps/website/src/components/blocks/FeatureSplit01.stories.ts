import type { Meta, StoryObj } from '@storybook/vue3-vite'

import FeatureSplit01 from './FeatureSplit01.vue'

const meta: Meta<typeof FeatureSplit01> = {
  title: 'Website/Blocks/FeatureSplit01',
  component: FeatureSplit01,
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
    heading: 'Observe\nand manage',
    body: 'Logs, spend, and API keys across the team workspace.\nControl which models, nodes, and ComfyUI versions your team runs.',
    image: {
      src: 'https://media.comfy.org/website/developers/observe-dashboard.webp',
      alt: 'The Comfy Cloud dashboard showing credit spend per day, broken down by product.'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/** The /developers shape: copy left, dashboard right. */
export const Default: Story = {}

/** Columns flipped from lg up; stacked, the text still leads. */
export const ImageLeft: Story = { args: { imagePosition: 'left' } }

/** A single-line heading and one sentence — no newlines anywhere. */
export const SingleLine: Story = {
  args: {
    heading: 'Observe and manage',
    body: 'Logs, spend, and API keys across the team workspace.'
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
