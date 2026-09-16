import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import FAQSplit01 from './FAQSplit01.vue'

const faqs = [
  {
    id: 'workflows',
    question: 'What is a ComfyUI workflow?',
    answer:
      'A workflow is a reusable graph that connects models, inputs, and processing steps.'
  },
  {
    id: 'local',
    question: 'Can I run ComfyUI locally?',
    answer:
      'Yes. Visit [the download page](/download) to choose the right build.'
  },
  {
    id: 'models',
    question: 'Which models are supported?',
    answer:
      'View the [supported models directory](/models) for current examples.'
  }
]

const meta: Meta<typeof FAQSplit01> = {
  title: 'Website/Blocks/FAQSplit01',
  component: FAQSplit01,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink"><story /></div>'
    })
  ],
  args: {
    heading: 'Frequently asked questions',
    faqs
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', {
      name: 'What is a ComfyUI workflow?'
    })

    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(
      canvas.getByText(/reusable graph that connects models/)
    ).toBeVisible()
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
