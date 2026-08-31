import type { Meta, StoryObj } from '@storybook/vue3-vite'

import StepsAccordion01 from './StepsAccordion01.vue'

const STEPS = [
  { id: 'match', title: 'Check your event is a good match' },
  { id: 'plan', title: 'Plan your event' },
  { id: 'apply', title: 'Apply' },
  { id: 'approved', title: 'Get approved and receive your event kit' },
  { id: 'host', title: 'Host your event' }
]

const meta: Meta<typeof StepsAccordion01> = {
  title: 'Website/Blocks/StepsAccordion01',
  component: StepsAccordion01,
  tags: ['autodocs'],
  args: {
    title: 'Host a Comfy event!',
    lead: 'Got an event coming up, or an idea in the works? Submit it for review to get support from Comfy.',
    cta: { label: 'Apply to host', href: '#' },
    steps: STEPS
  },
  render: (args) => ({
    components: { StepsAccordion01 },
    setup: () => ({ args }),
    // Each step body is a named slot, so rich content composes at the call
    // site rather than going through a string format.
    template: `
      <StepsAccordion01 v-bind="args">
        <template #match>
          <p class="text-sm text-primary-comfy-canvas/70">
            Before you apply, make sure your event ticks these boxes:
          </p>
          <ul class="mt-4 space-y-2 text-sm text-primary-warm-white">
            <li>Builders and artists as the primary audience</li>
            <li>20+ participants expected</li>
            <li>At least 2 weeks away</li>
          </ul>
          <h3 class="mt-6 text-base text-primary-warm-white">Who can host?</h3>
          <p class="mt-2 text-sm text-primary-comfy-canvas/70">
            Anyone passionate about bringing builders together.
          </p>
        </template>
        <template #plan>
          <p class="text-sm text-primary-comfy-canvas/70">
            Pick a date, a venue, and a format.
          </p>
        </template>
        <template #apply>
          <p class="text-sm text-primary-comfy-canvas/70">
            Send us the details through the application form.
          </p>
        </template>
        <template #approved>
          <p class="text-sm text-primary-comfy-canvas/70">
            We review and send your event kit.
          </p>
        </template>
        <template #host>
          <p class="text-sm text-primary-comfy-canvas/70">Run the day.</p>
        </template>
      </StepsAccordion01>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SecondStepOpen: Story = { args: { defaultOpen: 'plan' } }

export const WithoutCta: Story = { args: { cta: undefined, lead: undefined } }
