import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ProductHeroBadge from './ProductHeroBadge.vue'

const meta: Meta<typeof ProductHeroBadge> = {
  title: 'Website/Common/ProductHeroBadge',
  component: ProductHeroBadge,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Cloud: Story = {
  args: {
    text: 'CLOUD'
  }
}

export const CustomProduct: Story = {
  args: {
    logoSrc: '/icons/logomark.svg',
    logoAlt: 'Comfy',
    text: 'API'
  }
}
