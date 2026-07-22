import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ProcessToast from './ProcessToast.vue'

const meta: Meta<typeof ProcessToast> = {
  title: 'Common/ProcessToast',
  component: ProcessToast,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'dark' }
  },
  globals: { theme: 'dark' }
}

export default meta
type Story = StoryObj<typeof meta>

/** A single run: verb and live percent share one text run. */
export const InProgress: Story = {
  args: { verb: 'Running', percent: 45, status: 'progress' }
}

/** Waiting states have nothing to measure, so no percent and no bar. */
export const Indeterminate: Story = {
  args: { verb: 'Queued', percent: null, status: 'progress' }
}

export const Initializing: Story = {
  args: {
    verb: 'Initializing - Almost ready',
    percent: null,
    status: 'progress'
  }
}

/**
 * A batch counts through the burst. The bar still tracks the current job, but
 * the numeric percent steps aside so two numbers don't compete.
 */
export const BatchPosition: Story = {
  args: {
    verb: 'Running 3/7',
    percent: 45,
    status: 'progress',
    showPercentText: false
  }
}

/** Failures alongside work in flight stay a badge; the run keeps going. */
export const WithFailures: Story = {
  args: { verb: 'Running', percent: 45, status: 'progress', failedCount: 2 }
}

/** Terminal states drop every affordance: no stop, no chevron, no bar. */
export const Completed: Story = {
  args: { verb: 'Completed', status: 'done' }
}

export const Failed: Story = {
  args: { verb: 'Failed', status: 'failed' }
}

/** Nothing to expand into, so the chevron slab is suppressed. */
export const WithoutChevron: Story = {
  args: { verb: 'Running', percent: 45, status: 'progress', hideChevron: true }
}

export const Expanded: Story = {
  args: { verb: 'Running', percent: 45, status: 'progress', expanded: true },
  render: (args) => ({
    components: { ProcessToast },
    setup: () => ({ args }),
    template: `
      <ProcessToast v-bind="args">
        <template #panel>
          <div class="mt-1 w-80 rounded-lg border border-solid border-charcoal-700 bg-comfy-menu-bg p-3 text-sm text-base-foreground">
            Panel slot
          </div>
        </template>
      </ProcessToast>
    `
  })
}

/** Every state stacked, for reviewing weight and alignment in one pass. */
export const AllStates: Story = {
  render: () => ({
    components: { ProcessToast },
    setup: () => ({
      states: [
        { label: 'In progress · determinate', verb: 'Running', percent: 45 },
        { label: 'In progress · indeterminate', verb: 'Queued', percent: null },
        {
          label: 'Initializing',
          verb: 'Initializing - Almost ready',
          percent: null
        },
        {
          label: 'Batch · position',
          verb: 'Running 3/7',
          percent: 45,
          showPercentText: false
        },
        {
          label: 'Failures alongside work',
          verb: 'Running',
          percent: 45,
          failedCount: 2
        },
        { label: 'Done', verb: 'Completed', status: 'done' },
        { label: 'Failed only', verb: 'Failed', status: 'failed' }
      ]
    }),
    template: `
      <div class="flex flex-col gap-6 p-4">
        <div v-for="state in states" :key="state.label" class="flex flex-col gap-2">
          <p class="text-xs text-muted-foreground">{{ state.label }}</p>
          <div class="flex">
            <ProcessToast
              :verb="state.verb"
              :percent="state.percent ?? null"
              :status="state.status ?? 'progress'"
              :failed-count="state.failedCount ?? 0"
              :show-percent-text="state.showPercentText ?? true"
            />
          </div>
        </div>
      </div>
    `
  })
}
