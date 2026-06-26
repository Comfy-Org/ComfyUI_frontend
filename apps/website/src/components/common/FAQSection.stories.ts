import type { Meta, StoryObj } from '@storybook/vue3-vite'

import FAQSection from './FAQSection.vue'

const meta: Meta<typeof FAQSection> = {
  title: 'Website/Common/FAQSection',
  component: FAQSection,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ],
  args: {
    headingKey: 'download.faq.heading',
    faqPrefix: 'download.faq',
    faqCount: 3
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ManyItems: Story = {
  args: {
    headingKey: 'download.faq.heading',
    faqPrefix: 'download.faq',
    faqCount: 8
  }
}
