import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ArrowRight, ArrowUpRight } from '@lucide/vue'

import Button from './Button.vue'

const meta: Meta<typeof Button> = {
  title: 'Website/UI/Button',
  component: Button,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-page p-12"><story /></div>'
    })
  ],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: [
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
      ]
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'default', 'lg']
    },
    disabled: { control: 'boolean' }
  },
  args: {
    variant: 'default',
    size: 'lg',
    disabled: false
  },
  parameters: {
    docs: {
      description: {
        component:
          'Proposed button system: five variants, all UPPERCASE. Brand yellow is kept for the main action of a view; every other action is neutral. `lg` (56px) is the CTA size and `default` (40px) the small size, as the header TRY FREE.'
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

const proposedRows = [
  {
    name: 'Primary',
    variant: 'default',
    use: 'The main action, one per view: Try free, Generate, Run.'
  },
  {
    name: 'Primary outline',
    variant: 'outline',
    use: 'A strong action next to a primary.'
  },
  {
    name: 'Secondary',
    variant: 'secondary',
    use: 'An important action that should not compete with the brand yellow.'
  },
  {
    name: 'Secondary outline',
    variant: 'secondaryOutline',
    use: 'Supporting actions: Browse all, See all, filters.'
  },
  {
    name: 'Ghost',
    variant: 'ghost',
    use: 'Low emphasis: View on GitHub, secondary links. Previewed in UPPERCASE here; the variant itself is unchanged until this is agreed.',
    previewClass: 'font-bold tracking-wider uppercase'
  }
] as const

export const ProposedSystem: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every variant at rest and disabled, at both sizes. Hover and press them to see their states.'
      }
    }
  },
  render: () => ({
    components: { Button },
    setup: () => ({ rows: proposedRows }),
    template: `
      <div class="grid gap-8 text-primary-warm-white">
        <div
          v-for="row in rows"
          :key="row.variant"
          class="grid grid-cols-[14rem_1fr] items-center gap-8 border-t border-transparency-white-t8 pt-6"
        >
          <div class="flex flex-col gap-1">
            <span class="text-lg font-semibold">{{ row.name }}</span>
            <code class="text-xs text-primary-comfy-canvas">{{ row.variant }}</code>
            <span class="text-sm text-primary-comfy-canvas">{{ row.use }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <Button :variant="row.variant" size="lg" :class="row.previewClass">Button label</Button>
            <Button :variant="row.variant" :class="row.previewClass">Button label</Button>
            <Button :variant="row.variant" size="lg" :class="row.previewClass" disabled>Button label</Button>
            <Button :variant="row.variant" :class="row.previewClass" disabled>Button label</Button>
          </div>
        </div>
      </div>`
  })
}

export const InContext: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'One primary per view, the rest neutral: a page header with Ghost and Primary, and a shelf footer with Secondary outline.'
      }
    }
  },
  render: () => ({
    components: { Button, ArrowRight, ArrowUpRight },
    template: `
      <div class="grid gap-10 text-primary-warm-white">
        <div class="flex items-center justify-between gap-6 rounded-2xl border border-transparency-white-t8 p-6">
          <span class="text-2xl font-semibold">Re-shoot</span>
          <div class="flex items-center gap-3">
            <Button variant="ghost" class="font-bold tracking-wider uppercase" href="#">
              View on GitHub
              <template #append><ArrowUpRight /></template>
            </Button>
            <Button>Try free</Button>
          </div>
        </div>
        <div class="flex justify-center rounded-2xl border border-transparency-white-t8 p-6">
          <Button variant="secondaryOutline" size="lg" href="#">
            Browse all models
            <template #append><ArrowRight /></template>
          </Button>
        </div>
      </div>`
  })
}
