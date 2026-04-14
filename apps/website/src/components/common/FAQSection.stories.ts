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
    heading: 'FAQ',
    items: [
      {
        question: 'What hardware do I need to run ComfyUI?',
        answer:
          'A dedicated GPU is strongly recommended. NVIDIA GPUs with at least 4GB VRAM work best, but AMD and Apple Silicon are also supported.'
      },
      {
        question: 'Is ComfyUI free?',
        answer:
          'Yes, ComfyUI is completely free and open source. You can run it on your own hardware at no cost.'
      },
      {
        question: 'Can I use ComfyUI commercially?',
        answer:
          'Yes. ComfyUI is released under the GPL license, so you are free to use it for commercial purposes.'
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SingleItem: Story = {
  args: {
    heading: 'Questions',
    items: [
      {
        question: 'How do I get started?',
        answer: 'Download ComfyUI and follow the setup guide.'
      }
    ]
  }
}

export const ManyItems: Story = {
  args: {
    heading: 'Frequently Asked Questions',
    items: Array.from({ length: 8 }, (_, i) => ({
      question: `Question ${i + 1}: What about feature ${i + 1}?`,
      answer: `This is the detailed answer for question ${i + 1}. It explains everything you need to know about this particular topic.`
    }))
  }
}
