import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ProductCard from './ProductCard.vue'

const meta: Meta<typeof ProductCard> = {
  title: 'Website/Common/ProductCard',
  component: ProductCard,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ],
  args: {
    title: 'Comfy\nLocal',
    description: 'Run ComfyUI on your own hardware.',
    cta: 'SEE LOCAL FEATURES',
    href: '#',
    bg: 'bg-primary-warm-gray'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const AllCards: Story = {
  render: () => ({
    components: { ProductCard },
    template: `
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProductCard
          title="Comfy\nLocal"
          description="Run ComfyUI on your own hardware."
          cta="SEE LOCAL FEATURES"
          href="#"
          bg="bg-primary-warm-gray"
        />
        <ProductCard
          title="Comfy\nCloud"
          description="The full power of ComfyUI from anywhere."
          cta="SEE CLOUD FEATURES"
          href="#"
          bg="bg-secondary-mauve"
        />
        <ProductCard
          title="Comfy\nAPI"
          description="Turn workflows into production endpoints."
          cta="SEE API FEATURES"
          href="#"
          bg="bg-primary-comfy-plum"
        />
        <ProductCard
          title="Comfy\nEnterprise"
          description="Enterprise-grade infrastructure for the creative engine inside your organization."
          cta="SEE ENTERPRISE FEATURES"
          href="#"
          bg="bg-illustration-forest"
        />
      </div>
    `
  })
}
