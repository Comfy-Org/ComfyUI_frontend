import type { Meta, StoryObj } from '@storybook/vue3-vite'

import BrandButton from './BrandButton.vue'

const meta: Meta<typeof BrandButton> = {
  title: 'Website/Common/BrandButton',
  component: BrandButton,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['solid', 'outline']
    }
  },
  args: {
    href: '#',
    label: 'BUTTON LABEL'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Solid: Story = {
  args: {
    variant: 'solid'
  }
}

export const Outline: Story = {
  args: {
    variant: 'outline'
  }
}

export const AllVariants: Story = {
  render: () => ({
    components: { BrandButton },
    template: `
      <div class="flex gap-4">
        <BrandButton href="#" label="SOLID BUTTON" variant="solid" />
        <BrandButton href="#" label="OUTLINE BUTTON" variant="outline" />
      </div>
    `
  })
}
