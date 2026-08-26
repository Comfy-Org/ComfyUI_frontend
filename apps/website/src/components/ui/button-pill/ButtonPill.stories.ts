import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { userEvent, within } from 'storybook/test'
import type { ComponentProps } from 'vue-component-type-helpers'

import ButtonPill from './ButtonPill.vue'

type ButtonPillStoryArgs = ComponentProps<typeof ButtonPill> & {
  href?: string
  type?: 'button' | 'reset' | 'submit'
}

const meta = {
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
      options: ['default', 'lg']
    },
    iconPosition: {
      control: { type: 'select' },
      options: ['right', 'left']
    }
  }
} satisfies Meta<ButtonPillStoryArgs>

export default meta
type Story = StoryObj<ButtonPillStoryArgs>

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

export const WorkflowsPageReference: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          'Reference captured from the live Comfy Workflows page. The reveal mode is not implemented by this website component yet and is not approved for production use.'
      }
    }
  },
  render: () => ({
    template: `
      <a
        href="#"
        aria-label="Example workflow"
        class="group/button-pill relative isolate inline-flex h-10 w-fit cursor-pointer items-center overflow-hidden rounded-2xl bg-transparent py-2.5 ps-9 pe-0 text-sm font-bold uppercase tracking-wider text-content text-nowrap transition-all duration-500 hover:bg-primary-comfy-yellow hover:pe-5 hover:text-primary-comfy-ink"
      >
        <span class="grid grid-cols-[0fr] transition-[grid-template-columns] duration-500 group-hover/button-pill:grid-cols-[1fr]">
          <span class="overflow-hidden">
            <span class="ppformula-text-center relative leading-none">Try now</span>
          </span>
        </span>
        <span
          aria-hidden="true"
          class="absolute left-1 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl bg-white/20 text-white transition-all duration-500 group-hover/button-pill:bg-primary-comfy-yellow group-hover/button-pill:text-primary-comfy-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </a>
    `
  }),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('link', { name: 'Example workflow' })

    await step('Reveal label', async () => {
      await userEvent.hover(button)
    })
    await step('Reset button', async () => {
      await userEvent.unhover(button)
    })
  }
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
