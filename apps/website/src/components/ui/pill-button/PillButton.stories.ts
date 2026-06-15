import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PillButton from './PillButton.vue'

const meta: Meta<typeof PillButton> = {
  title: 'Website/UI/PillButton',
  component: PillButton,
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
    components: { PillButton },
    setup: () => ({ args }),
    template: `<PillButton v-bind="args">Let's Collaborate</PillButton>`
  })
}

export const AsButton: Story = {
  args: { as: 'button', type: 'button' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: '<PillButton v-bind="args">Submit</PillButton>'
  })
}

export const Ghost: Story = {
  args: { as: 'a', href: '#', variant: 'ghost' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: '<PillButton v-bind="args">Read More</PillButton>'
  })
}

export const DefaultSolid: Story = {
  args: { as: 'a', href: '#', size: 'default' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: '<PillButton v-bind="args">Try Workflow</PillButton>'
  })
}

export const LargeSolid: Story = {
  args: { as: 'a', href: '#', size: 'lg' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: `<PillButton v-bind="args">Let's Collaborate</PillButton>`
  })
}

export const WithCustomIcon: Story = {
  args: { as: 'a', href: '#' },
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
  args: { as: 'a', href: '#', iconPosition: 'left' },
  render: (args) => ({
    components: { PillButton },
    setup: () => ({ args }),
    template: '<PillButton v-bind="args">Go Back</PillButton>'
  })
}

export const RevealLabelOnHover: Story = {
  args: { as: 'a', href: '#', hideLabel: true },
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
            <PillButton as="a" href="#" variant="solid" size="default">Default</PillButton>
            <PillButton as="a" href="#" variant="solid" size="lg">Large</PillButton>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <span class="text-primary-comfy-canvas text-xs uppercase tracking-wider">Ghost</span>
          <div class="flex flex-wrap items-center gap-4">
            <PillButton as="a" href="#" variant="ghost" size="default">Default</PillButton>
            <PillButton as="a" href="#" variant="ghost" size="lg">Large</PillButton>
          </div>
        </div>
      </div>
    `
  })
}
