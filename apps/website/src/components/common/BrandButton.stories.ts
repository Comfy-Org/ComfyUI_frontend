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
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'lg']
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

export const LargeSolid: Story = {
  args: {
    variant: 'solid',
    size: 'lg'
  }
}

export const LargeOutline: Story = {
  args: {
    variant: 'outline',
    size: 'lg'
  }
}

export const AllVariants: Story = {
  render: () => ({
    components: { BrandButton },
    template: `
      <div class="flex flex-col gap-4">
        <div class="flex gap-4 items-center">
          <BrandButton href="#" label="SOLID SM" variant="solid" size="sm" />
          <BrandButton href="#" label="OUTLINE SM" variant="outline" size="sm" />
        </div>
        <div class="flex gap-4 items-center">
          <BrandButton href="#" label="SOLID LG" variant="solid" size="lg" />
          <BrandButton href="#" label="OUTLINE LG" variant="outline" size="lg" />
        </div>
      </div>
    `
  })
}
