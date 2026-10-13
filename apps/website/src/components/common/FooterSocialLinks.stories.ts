import type { Meta, StoryObj } from '@storybook/vue3-vite'

import FooterSocialLinks from './FooterSocialLinks.vue'

const meta: Meta<typeof FooterSocialLinks> = {
  title: 'Website/Common/FooterSocialLinks',
  component: FooterSocialLinks,
  tags: ['autodocs'],
  args: { locale: 'en' },
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-comfy-ink text-primary-comfy-canvas p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
