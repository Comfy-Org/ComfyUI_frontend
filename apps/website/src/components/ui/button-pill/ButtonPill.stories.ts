import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ButtonPill from './ButtonPill.vue'

const meta: Meta<typeof ButtonPill> = {
  title: 'Website/UI/ButtonPill',
  component: ButtonPill,
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

export const AsAnchor: Story = {
  args: { as: 'a', href: '#' },
  render: (args) => ({
    components: { ButtonPill },
    setup: () => ({ args }),
    template: `<ButtonPill v-bind="args">Let's Collaborate</ButtonPill>`
  })
}

export const AsButton: Story = {
  args: { as: 'button', type: 'button' },
  render: (args) => ({
    components: { ButtonPill },
    setup: () => ({ args }),
    template: '<ButtonPill v-bind="args">Submit</ButtonPill>'
  })
}

export const Ghost: Story = {
  args: { as: 'a', href: '#', variant: 'ghost' },
  render: (args) => ({
    components: { ButtonPill },
    setup: () => ({ args }),
    template: '<ButtonPill v-bind="args">Read More</ButtonPill>'
  })
}

export const DefaultSolid: Story = {
  args: { as: 'a', href: '#', size: 'default' },
  render: (args) => ({
    components: { ButtonPill },
    setup: () => ({ args }),
    template: '<ButtonPill v-bind="args">Try Workflow</ButtonPill>'
  })
}

export const LargeSolid: Story = {
  args: { as: 'a', href: '#', size: 'lg' },
  render: (args) => ({
    components: { ButtonPill },
    setup: () => ({ args }),
    template: `<ButtonPill v-bind="args">Let's Collaborate</ButtonPill>`
  })
}

export const WithCustomIcon: Story = {
  args: { as: 'a', href: '#' },
  render: (args) => ({
    components: { ButtonPill },
    setup: () => ({ args }),
    template: `
      <ButtonPill v-bind="args">
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
      </ButtonPill>
    `
  })
}

export const IconLeft: Story = {
  args: { as: 'a', href: '#', iconPosition: 'left' },
  render: (args) => ({
    components: { ButtonPill },
    setup: () => ({ args }),
    template: '<ButtonPill v-bind="args">Go Back</ButtonPill>'
  })
}

export const RevealLabelOnHover: Story = {
  args: { as: 'a', href: '#', hideLabel: true },
  render: (args) => ({
    components: { ButtonPill },
    setup: () => ({ args }),
    template: '<ButtonPill v-bind="args">Try Workflow</ButtonPill>'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { ButtonPill },
    setup: () => ({ args }),
    template: '<ButtonPill v-bind="args">Unavailable</ButtonPill>'
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { ButtonPill },
    template: `
      <div class="flex flex-col gap-8">
        <div class="flex flex-col gap-3">
          <span class="text-primary-comfy-canvas text-xs uppercase tracking-wider">Solid</span>
          <div class="flex flex-wrap items-center gap-4">
            <ButtonPill as="a" href="#" variant="solid" size="default">Default</ButtonPill>
            <ButtonPill as="a" href="#" variant="solid" size="lg">Large</ButtonPill>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <span class="text-primary-comfy-canvas text-xs uppercase tracking-wider">Ghost</span>
          <div class="flex flex-wrap items-center gap-4">
            <ButtonPill as="a" href="#" variant="ghost" size="default">Default</ButtonPill>
            <ButtonPill as="a" href="#" variant="ghost" size="lg">Large</ButtonPill>
          </div>
        </div>
      </div>
    `
  })
}
