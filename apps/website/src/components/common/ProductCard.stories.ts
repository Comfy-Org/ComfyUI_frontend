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
    title: 'Comfy\nDesktop',
    description: 'Run ComfyUI on your own hardware.',
    cta: 'SEE DESKTOP FEATURES',
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
          title="Comfy\nDesktop"
          description="Run ComfyUI on your own hardware."
          cta="SEE DESKTOP FEATURES"
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

export const LightTone: Story = {
  args: {
    tone: 'light',
    title: 'Cloud\nAPI',
    description:
      'Turn any workflow into a production endpoint. Trigger generation from code, inject inputs at runtime, and scale on Comfy Cloud.',
    cta: 'Try now',
    bg: undefined
  },
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-warm-white grid grid-cols-1 gap-2 p-8 lg:grid-cols-4 lg:gap-y-0"><story /></div>'
    })
  ]
}

export const LightToneRow: Story = {
  decorators: [
    () => ({
      template: '<div class="bg-primary-warm-white p-8"><story /></div>'
    })
  ],
  render: () => ({
    components: { ProductCard },
    template: `
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-y-0">
        <ProductCard
          tone="light"
          title="Cloud\nAPI"
          description="Turn any workflow into a production endpoint. Trigger generation from code, inject inputs at runtime, and scale on Comfy Cloud."
          cta="Try now"
          href="#"
        />
        <ProductCard
          tone="light"
          title="Serverless\nAPI"
          description="Deploy a ComfyUI build with your own custom nodes and models, then run any workflow on it. Scales with traffic, down to zero. In limited beta."
          cta="Join beta"
          href="#"
        />
        <ProductCard
          tone="light"
          title="SDK"
          description="Call ComfyUI workflows from your own code in Python or TypeScript. Running on Comfy Cloud today."
          cta="Try now"
          href="#"
        />
        <ProductCard
          tone="light"
          title="Comfy\nRouter"
          description="Call every partner model in ComfyUI by ID. Veo, Kling, Nano Banana, Flux. One API key, one credit balance, no per-provider accounts."
          cta="Try now"
          href="#"
        />
      </div>
    `
  })
}
