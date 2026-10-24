import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

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

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [firstQuestion] = canvas.getAllByRole('button')

    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(firstQuestion)
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')

    const panelId = firstQuestion.getAttribute('aria-controls')
    const panel = panelId ? canvasElement.querySelector(`#${panelId}`) : null
    await expect(panel).toBeVisible()

    await userEvent.click(firstQuestion)
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
    await expect(panel).not.toBeVisible()
  }
}

export const ManyItems: Story = {
  args: {
    headingKey: 'download.faq.heading',
    faqPrefix: 'download.faq',
    faqCount: 8
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
