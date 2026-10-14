import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from './Button.vue'

const variants = [
  'default',
  'outline',
  'secondary',
  'secondaryOutline',
  'ghost',
  'link',
  'underlineLink',
  'inline',
  'nav',
  'navMuted'
] as const

const meta: Meta<typeof Button> = {
  title: 'Website/UI/Button',
  component: Button,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ],
  argTypes: {
    variant: { control: { type: 'select' }, options: variants },
    size: { control: { type: 'select' }, options: ['sm', 'default', 'lg'] },
    disabled: { control: 'boolean' }
  },
  args: {
    variant: 'default',
    size: 'default',
    disabled: false
  },
  parameters: {
    docs: {
      description: {
        component:
          'Brand yellow is for the main action of a view. Every other action uses a neutral variant: `secondary` for an important action that should not compete with the yellow, `secondaryOutline` for supporting actions such as Browse all or Clear filters, `ghost` for low emphasis. Pick the variant per call site.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: '<Button v-bind="args">Button label</Button>'
  })
}

const actionVariants = [
  { variant: 'default', use: 'Main action, one per view' },
  { variant: 'outline', use: 'Strong action next to a primary' },
  { variant: 'secondary', use: 'Important action, neutral' },
  { variant: 'secondaryOutline', use: 'Supporting action' },
  { variant: 'ghost', use: 'Low emphasis' }
] as const

export const ActionVariants: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The five action variants at the 40px and 56px sizes, enabled and disabled. Hover and press them to see their states.'
      }
    }
  },
  render: () => ({
    components: { Button },
    setup: () => ({ rows: actionVariants }),
    template: `
      <div class="grid gap-6 text-primary-warm-white">
        <div
          v-for="row in rows"
          :key="row.variant"
          class="grid grid-cols-[12rem_1fr] items-center gap-6"
        >
          <div class="flex flex-col gap-1">
            <code class="text-sm">{{ row.variant }}</code>
            <span class="text-xs text-primary-comfy-canvas">{{ row.use }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <Button :variant="row.variant">Button label</Button>
            <Button :variant="row.variant" size="lg">Button label</Button>
            <Button :variant="row.variant" disabled>Button label</Button>
          </div>
        </div>
      </div>
    `
  })
}
