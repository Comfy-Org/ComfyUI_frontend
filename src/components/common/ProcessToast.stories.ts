import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
        { label: 'Initializing', verb: 'Starting', percent: null },
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

/**
 * Walks the real job lifecycle on a slow timer so the transitions between
 * states can actually be watched — the backend rarely reaches them on demand.
 * The dashed guide shows the pill holding one width the whole way through.
 */
export const Lifecycle: Story = {
  argTypes: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stepMs: { control: { type: 'range', min: 800, max: 6000, step: 200 } }
  } as never,
  args: { stepMs: 2600 } as never,
  render: (args) => ({
    components: { ProcessToast },
    setup() {
      const stepMs = computed(() => (args as { stepMs?: number }).stepMs ?? 2600)

      // Percent-bearing steps tick while they are on screen; the rest hold.
      type Step = {
        name: string
        verb: string
        percent?: number | null
        status?: 'progress' | 'done' | 'failed'
        failedCount?: number
        showPercentText?: boolean
        ticks?: boolean
      }
      const steps: Step[] = [
        { name: 'Queued', verb: 'Queued 3', percent: null },
        { name: 'Starting', verb: 'Starting', percent: null },
        { name: 'Running', verb: 'Running', percent: 0, ticks: true },
        {
          name: 'Batch',
          verb: 'Running 3/7',
          percent: 0,
          ticks: true,
          showPercentText: false
        },
        { name: 'With failures', verb: 'Running', percent: 62, failedCount: 2 },
        { name: 'Completed', verb: 'Completed', status: 'done' },
        { name: 'Failed', verb: 'Failed', status: 'failed' }
      ]

      const index = ref(0)
      const percent = ref(0)
      const paused = ref(false)
      const step = computed(() => steps[index.value])

      let stepTimer: ReturnType<typeof setInterval> | undefined
      let tickTimer: ReturnType<typeof setInterval> | undefined

      const start = () => {
        stepTimer = setInterval(() => {
          if (paused.value) return
          index.value = (index.value + 1) % steps.length
          percent.value = 0
        }, stepMs.value)
        // Enough ticks to cross the bar within one step
        tickTimer = setInterval(() => {
          if (paused.value || !step.value.ticks) return
          percent.value = Math.min(100, percent.value + 4)
        }, stepMs.value / 25)
      }
      const stop = () => {
        clearInterval(stepTimer)
        clearInterval(tickTimer)
      }

      onMounted(start)
      onBeforeUnmount(stop)
      watch(stepMs, () => {
        stop()
        start()
      })

      return { steps, index, percent, paused, step }
    },
    template: `
      <div class="flex flex-col gap-4 p-4">
        <div class="flex items-center gap-3">
          <button
            class="cursor-pointer rounded-md border border-solid border-charcoal-700 bg-secondary-background px-2 py-1 text-xs text-base-foreground"
            @click="paused = !paused"
          >
            {{ paused ? 'Play' : 'Pause' }}
          </button>
          <div class="flex gap-1">
            <button
              v-for="(s, i) in steps"
              :key="s.name"
              class="cursor-pointer rounded-md border-none px-2 py-1 text-xs"
              :class="i === index ? 'bg-base-foreground text-base-background' : 'bg-secondary-background text-muted-foreground'"
              @click="index = i; percent = 0"
            >
              {{ s.name }}
            </button>
          </div>
        </div>

        <div class="w-max border border-dashed border-base-foreground/20 p-2">
          <ProcessToast
            :verb="step.verb"
            :percent="step.ticks ? percent : (step.percent ?? null)"
            :status="step.status ?? 'progress'"
            :failed-count="step.failedCount ?? 0"
            :show-percent-text="step.showPercentText ?? true"
          />
        </div>

        <p class="text-xs text-muted-foreground">
          Dashed box is fixed to the pill's natural width — the pill should
          never pull away from it as the copy changes.
        </p>
      </div>
    `
  })
}
