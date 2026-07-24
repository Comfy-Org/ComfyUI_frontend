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
      options: ['solid', 'outline', 'outline-dark']
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'nav', 'lg']
    }
  },
  args: {
    href: '#'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Solid: Story = {
  args: { variant: 'solid' },
  render: (args) => ({
    components: { BrandButton },
    setup: () => ({ args }),
    template: '<BrandButton v-bind="args">BUTTON LABEL</BrandButton>'
  })
}

export const Outline: Story = {
  args: { variant: 'outline' },
  render: (args) => ({
    components: { BrandButton },
    setup: () => ({ args }),
    template: '<BrandButton v-bind="args">BUTTON LABEL</BrandButton>'
  })
}

export const OutlineDark: Story = {
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-yellow p-8"><story /></div>'
    })
  ],
  args: { variant: 'outline-dark' },
  render: (args) => ({
    components: { BrandButton },
    setup: () => ({ args }),
    template: '<BrandButton v-bind="args">VISIT HUB</BrandButton>'
  })
}

export const LargeSolid: Story = {
  args: { variant: 'solid', size: 'lg' },
  render: (args) => ({
    components: { BrandButton },
    setup: () => ({ args }),
    template: '<BrandButton v-bind="args">BUTTON LABEL</BrandButton>'
  })
}

export const LargeOutline: Story = {
  args: { variant: 'outline', size: 'lg' },
  render: (args) => ({
    components: { BrandButton },
    setup: () => ({ args }),
    template: '<BrandButton v-bind="args">BUTTON LABEL</BrandButton>'
  })
}

export const AsButton: Story = {
  args: { variant: 'solid' },
  render: (args) => ({
    components: { BrandButton },
    setup: () => ({ args }),
    template: '<BrandButton v-bind="args">SUBMIT</BrandButton>'
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { BrandButton },
    template: `
      <div class="flex flex-col gap-4">
        <div class="flex gap-4 items-center">
          <BrandButton href="#" variant="solid" size="xs">SOLID XS</BrandButton>
          <BrandButton href="#" variant="outline" size="xs">OUTLINE XS</BrandButton>
        </div>
        <div class="flex gap-4 items-center">
          <BrandButton href="#" variant="solid" size="sm">SOLID SM</BrandButton>
          <BrandButton href="#" variant="outline" size="sm">OUTLINE SM</BrandButton>
        </div>
        <div class="flex gap-4 items-center">
          <BrandButton href="#" variant="solid" size="nav">SOLID NAV</BrandButton>
          <BrandButton href="#" variant="outline" size="nav">OUTLINE NAV</BrandButton>
        </div>
        <div class="flex gap-4 items-center">
          <BrandButton href="#" variant="solid" size="lg">SOLID LG</BrandButton>
          <BrandButton href="#" variant="outline" size="lg">OUTLINE LG</BrandButton>
        </div>
        <div class="flex gap-4 items-center bg-primary-comfy-yellow p-4 rounded-xl">
          <BrandButton href="#" variant="outline-dark" size="lg">OUTLINE DARK</BrandButton>
        </div>
        <div class="flex gap-4 items-center">
          <BrandButton variant="solid" size="sm">BUTTON (no href)</BrandButton>
          <BrandButton variant="outline" size="sm">BUTTON (no href)</BrandButton>
        </div>
      </div>
    `
  })
}
