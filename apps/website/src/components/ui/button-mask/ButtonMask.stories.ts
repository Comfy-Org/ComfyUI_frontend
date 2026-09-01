import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ButtonMask from './ButtonMask.vue'

const meta: Meta<typeof ButtonMask> = {
  title: 'Website/UI/ButtonMask',
  component: ButtonMask,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-12"><story /></div>'
    })
  ],
  argTypes: {
    as: {
      control: { type: 'select' },
      options: ['button', 'a']
    },
    asChild: { control: 'boolean' },
    disabled: { control: 'boolean' },
    variant: {
      control: { type: 'select' },
      options: ['solid', 'ghost']
    },
    size: {
      control: { type: 'select' },
      options: ['default', 'lg', 'icon']
    },
    iconPosition: {
      control: { type: 'select' },
      options: ['right', 'left']
    },
    hideLabel: { control: 'boolean' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { as: 'a', href: '#' },
  render: (args) => ({
    components: { ButtonMask },
    setup: () => ({ args }),
    template: `<ButtonMask v-bind="args">Try Workflow</ButtonMask>`
  })
}

export const Ghost: Story = {
  args: { as: 'a', href: '#', variant: 'ghost' },
  render: (args) => ({
    components: { ButtonMask },
    setup: () => ({ args }),
    template: '<ButtonMask v-bind="args">Read More</ButtonMask>'
  })
}

export const IconLeft: Story = {
  args: { as: 'a', href: '#', iconPosition: 'left' },
  render: (args) => ({
    components: { ButtonMask },
    setup: () => ({ args }),
    template: '<ButtonMask v-bind="args">Go Back</ButtonMask>'
  })
}

export const DefaultSolid: Story = {
  args: { as: 'a', href: '#', size: 'default' },
  render: (args) => ({
    components: { ButtonMask },
    setup: () => ({ args }),
    template: '<ButtonMask v-bind="args">Try Workflow</ButtonMask>'
  })
}

export const LargeSolid: Story = {
  args: { as: 'a', href: '#', size: 'lg' },
  render: (args) => ({
    components: { ButtonMask },
    setup: () => ({ args }),
    template: `<ButtonMask v-bind="args">Let's Collaborate</ButtonMask>`
  })
}

export const WithCustomIcon: Story = {
  args: { as: 'a', href: '#' },
  render: (args) => ({
    components: { ButtonMask },
    setup: () => ({ args }),
    template: `
      <ButtonMask v-bind="args">
        Next Step
        <template #icon>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </template>
      </ButtonMask>
    `
  })
}

export const LabelVisible: Story = {
  args: { as: 'a', href: '#', hideLabel: false },
  render: (args) => ({
    components: { ButtonMask },
    setup: () => ({ args }),
    template: '<ButtonMask v-bind="args">Always Visible</ButtonMask>'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { ButtonMask },
    setup: () => ({ args }),
    template: '<ButtonMask v-bind="args">Unavailable</ButtonMask>'
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { ButtonMask },
    template: `
      <div class="flex flex-col gap-8">
        <div class="flex flex-col gap-3">
          <span class="text-primary-comfy-canvas text-xs uppercase tracking-wider">Solid</span>
          <div class="flex flex-wrap items-center gap-4">
            <ButtonMask as="a" href="#" variant="solid" size="default">Default</ButtonMask>
            <ButtonMask as="a" href="#" variant="solid" size="lg">Large</ButtonMask>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <span class="text-primary-comfy-canvas text-xs uppercase tracking-wider">Ghost</span>
          <div class="flex flex-wrap items-center gap-4">
            <ButtonMask as="a" href="#" variant="ghost" size="default">Default</ButtonMask>
            <ButtonMask as="a" href="#" variant="ghost" size="lg">Large</ButtonMask>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <span class="text-primary-comfy-canvas text-xs uppercase tracking-wider">Icon Left</span>
          <div class="flex flex-wrap items-center gap-4">
            <ButtonMask as="a" href="#" iconPosition="left" size="default">Default</ButtonMask>
            <ButtonMask as="a" href="#" iconPosition="left" size="lg">Large</ButtonMask>
          </div>
        </div>
      </div>
    `
  })
}
