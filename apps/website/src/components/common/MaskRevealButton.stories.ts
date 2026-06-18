import type { Meta, StoryObj } from '@storybook/vue3-vite'

import MaskRevealButton from './MaskRevealButton.vue'

const meta: Meta<typeof MaskRevealButton> = {
  title: 'Website/Common/MaskRevealButton',
  component: MaskRevealButton,
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

export const Default: Story = {
  args: { href: '#' },
  render: (args) => ({
    components: { MaskRevealButton },
    setup: () => ({ args }),
    template: `<MaskRevealButton v-bind="args">Try Workflow</MaskRevealButton>`
  })
}

export const Ghost: Story = {
  args: { href: '#', variant: 'ghost' },
  render: (args) => ({
    components: { MaskRevealButton },
    setup: () => ({ args }),
    template: '<MaskRevealButton v-bind="args">Read More</MaskRevealButton>'
  })
}

export const IconLeft: Story = {
  args: { href: '#', iconPosition: 'left' },
  render: (args) => ({
    components: { MaskRevealButton },
    setup: () => ({ args }),
    template: '<MaskRevealButton v-bind="args">Go Back</MaskRevealButton>'
  })
}

export const SmallSolid: Story = {
  args: { href: '#', size: 'sm' },
  render: (args) => ({
    components: { MaskRevealButton },
    setup: () => ({ args }),
    template: '<MaskRevealButton v-bind="args">Try Workflow</MaskRevealButton>'
  })
}

export const LargeSolid: Story = {
  args: { href: '#', size: 'lg' },
  render: (args) => ({
    components: { MaskRevealButton },
    setup: () => ({ args }),
    template: `<MaskRevealButton v-bind="args">Let's Collaborate</MaskRevealButton>`
  })
}

export const WithCustomIcon: Story = {
  args: { href: '#' },
  render: (args) => ({
    components: { MaskRevealButton },
    setup: () => ({ args }),
    template: `
      <MaskRevealButton v-bind="args">
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
      </MaskRevealButton>
    `
  })
}

export const LabelVisible: Story = {
  args: { href: '#', hideLabel: false },
  render: (args) => ({
    components: { MaskRevealButton },
    setup: () => ({ args }),
    template:
      '<MaskRevealButton v-bind="args">Always Visible</MaskRevealButton>'
  })
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { MaskRevealButton },
    setup: () => ({ args }),
    template: '<MaskRevealButton v-bind="args">Unavailable</MaskRevealButton>'
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { MaskRevealButton },
    template: `
      <div class="flex flex-col gap-8">
        <div class="flex flex-col gap-3">
          <span class="text-primary-comfy-canvas text-xs uppercase tracking-wider">Solid</span>
          <div class="flex flex-wrap items-center gap-4">
            <MaskRevealButton href="#" variant="solid" size="sm">Small</MaskRevealButton>
            <MaskRevealButton href="#" variant="solid" size="md">Medium</MaskRevealButton>
            <MaskRevealButton href="#" variant="solid" size="lg">Large</MaskRevealButton>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <span class="text-primary-comfy-canvas text-xs uppercase tracking-wider">Ghost</span>
          <div class="flex flex-wrap items-center gap-4">
            <MaskRevealButton href="#" variant="ghost" size="sm">Small</MaskRevealButton>
            <MaskRevealButton href="#" variant="ghost" size="md">Medium</MaskRevealButton>
            <MaskRevealButton href="#" variant="ghost" size="lg">Large</MaskRevealButton>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <span class="text-primary-comfy-canvas text-xs uppercase tracking-wider">Icon Left</span>
          <div class="flex flex-wrap items-center gap-4">
            <MaskRevealButton href="#" iconPosition="left" size="sm">Small</MaskRevealButton>
            <MaskRevealButton href="#" iconPosition="left" size="md">Medium</MaskRevealButton>
            <MaskRevealButton href="#" iconPosition="left" size="lg">Large</MaskRevealButton>
          </div>
        </div>
      </div>
    `
  })
}
