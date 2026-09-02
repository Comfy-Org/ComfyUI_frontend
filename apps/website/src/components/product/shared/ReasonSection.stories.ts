import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { Reason } from './ReasonSection.vue'

import ReasonSection from './ReasonSection.vue'

const defaultReasons: Reason[] = [
  {
    titleKey: 'download.reason.1.title',
    descriptionKey: 'download.reason.1.description'
  },
  {
    titleKey: 'download.reason.2.title',
    descriptionKey: 'download.reason.2.description'
  },
  {
    titleKey: 'download.reason.3.title',
    descriptionKey: 'download.reason.3.description'
  },
  {
    titleKey: 'download.reason.4.title',
    descriptionKey: 'download.reason.4.description'
  }
]

const meta: Meta<typeof ReasonSection> = {
  title: 'Website/Product/ReasonSection',
  component: ReasonSection,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ],
  args: {
    headingKey: 'download.reason.heading',
    headingHighlightKey: 'download.reason.headingHighlight',
    highlightClass: 'text-primary-warm-white',
    reasons: defaultReasons
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FewReasons: Story = {
  args: {
    reasons: defaultReasons.slice(0, 2)
  }
}
