import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PillButton from './PillButton.vue'

const meta: Meta<typeof PillButton> = {
  title: 'Website/Common/PillButton',
  component: PillButton,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-12"><story /></div>'
    })
  ],
  argTypes: {
    href: { control: 'text' },
    target: { control: 'text' },
    rel: { control: 'text' },
    type: {
      control: { type: 'select' },
      options: ['button', 'submit', 'reset']
    },
    disabled: { control: 'boolean' },
    ariaLabel: { control: 'text' },
    variant: {
      control: { type: 'select' },
      options: ['solid', 'ghost']
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg']
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
  args: { href: '#' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: `<PillButton v-bind="args">Let's Collaborate</PillButton>`
  })
}

export const AsButton: Story = {
  args: { type: 'button' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: '<PillButton v-bind="args">Submit</PillButton>'
  })
}

export const Ghost: Story = {
  args: { href: '#', variant: 'ghost' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: '<PillButton v-bind="args">Read More</PillButton>'
  })
}

export const SmallSolid: Story = {
  args: { href: '#', size: 'sm' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: '<PillButton v-bind="args">Try Workflow</PillButton>'
  })
}

export const LargeSolid: Story = {
  args: { href: '#', size: 'lg' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: `<PillButton v-bind="args">Let's Collaborate</PillButton>`
  })
}

export const WithCustomIcon: Story = {
  args: { href: '#' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: `
      <PillButton v-bind="args">
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
      </PillButton>
    `
  })
}

export const IconLeft: Story = {
  args: { href: '#', iconPosition: 'left' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: '<PillButton v-bind="args">Go Back</PillButton>'
  })
}

export const RevealLabelOnHover: Story = {
  args: { href: '#', hideLabel: true },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: '<PillButton v-bind="args">Try Workflow</PillButton>'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: '<PillButton v-bind="args">Unavailable</PillButton>'
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { PillButton },
    template: `
      <div class="flex flex-col gap-8">
        <div class="flex flex-col gap-3">
          <span class="text-primary-comfy-canvas text-xs uppercase tracking-wider">Solid</span>
          <div class="flex flex-wrap items-center gap-4">
            <PillButton href="#" variant="solid" size="sm">Small</PillButton>
            <PillButton href="#" variant="solid" size="md">Medium</PillButton>
            <PillButton href="#" variant="solid" size="lg">Large</PillButton>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <span class="text-primary-comfy-canvas text-xs uppercase tracking-wider">Ghost</span>
          <div class="flex flex-wrap items-center gap-4">
            <PillButton href="#" variant="ghost" size="sm">Small</PillButton>
            <PillButton href="#" variant="ghost" size="md">Medium</PillButton>
            <PillButton href="#" variant="ghost" size="lg">Large</PillButton>
          </div>
        </div>
      </div>
    `
  })
}
