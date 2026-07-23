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
 * Full-bleed demo with a control bar docked at the bottom: every case mapped
 * in Figma, driven by hand or played through in order. The backend rarely
 * reaches these states on demand, so this is how they get reviewed and shown.
 */
export const Demo: Story = {
  parameters: { layout: 'fullscreen' },
  argTypes: {
    runSeconds: { control: { type: 'range', min: 4, max: 60, step: 2 } },
    holdSeconds: { control: { type: 'range', min: 1, max: 12, step: 1 } }
  } as never,
  args: { runSeconds: 20, holdSeconds: 3 } as never,
  render: (args) => ({
    components: { ProcessToast },
    setup() {
      const opts = args as { runSeconds?: number; holdSeconds?: number }
      const runSeconds = computed(() => opts.runSeconds ?? 20)
      const holdSeconds = computed(() => opts.holdSeconds ?? 3)

      type Case = {
        name: string
        verb: string
        percent?: number | null
        status?: 'progress' | 'done' | 'failed'
        failedCount?: number
        showPercentText?: boolean
        /** Drives the percent from 0 to 100 while on screen. */
        ticks?: boolean
        /** Seconds to hold before advancing; ticking cases run their course. */
        hold?: number
        /** Only an executing job can be stopped, as in the queue instance. */
        stoppable?: boolean
      }

      const cases: Case[] = [
        { name: 'Queued', verb: 'Queued 3', percent: null },
        { name: 'Starting', verb: 'Starting', percent: null },
        {
          name: 'Running',
          verb: 'Running',
          percent: 0,
          ticks: true,
          stoppable: true
        },
        {
          name: 'Batch 3/7',
          verb: 'Running 3/7',
          percent: 0,
          ticks: true,
          showPercentText: false,
          stoppable: true
        },
        {
          name: 'With failures',
          verb: 'Running',
          percent: 62,
          failedCount: 2,
          stoppable: true
        },
        { name: 'Completed', verb: 'Completed', status: 'done' },
        { name: 'Failed', verb: 'Failed', status: 'failed' }
      ]

      const index = ref(0)
      const percent = ref(0)
      const playing = ref(false)
      const expanded = ref(false)
      const current = computed(() => cases[index.value])

      const TICK_MS = 100
      let timer: ReturnType<typeof setInterval> | undefined
      let heldMs = 0

      const select = (i: number) => {
        index.value = i
        percent.value = 0
        heldMs = 0
      }

      const advance = () => {
        select((index.value + 1) % cases.length)
      }

      const onTick = () => {
        const step = current.value
        if (step.ticks) {
          // A full 0-100 sweep spans runSeconds, slow enough to actually watch
          percent.value = Math.min(
            100,
            percent.value + (100 * TICK_MS) / (runSeconds.value * 1000)
          )
          if (playing.value && percent.value >= 100) advance()
          return
        }
        if (!playing.value) return
        heldMs += TICK_MS
        if (heldMs >= (step.hold ?? holdSeconds.value) * 1000) advance()
      }

      onMounted(() => {
        timer = setInterval(onTick, TICK_MS)
      })
      onBeforeUnmount(() => clearInterval(timer))
      watch([runSeconds, holdSeconds], () => {
        heldMs = 0
      })

      return { cases, index, percent, playing, expanded, current, select }
    },
    template: `
      <div class="relative flex h-screen flex-col bg-charcoal-900">
        <!-- Stage -->
        <div class="flex flex-1 items-start justify-end p-6">
          <ProcessToast
            :verb="current.verb"
            :percent="current.ticks ? Math.round(percent) : (current.percent ?? null)"
            :status="current.status ?? 'progress'"
            :failed-count="current.failedCount ?? 0"
            :show-percent-text="current.showPercentText ?? true"
            :hide-action="!current.stoppable"
            :expanded="expanded"
            @toggle-expand="expanded = !expanded"
          >
            <template #action>
              <button class="flex size-4 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-base-foreground">
                <i class="icon-[comfy--stop] size-4" />
              </button>
            </template>
            <template #panel>
              <div class="mt-1 flex w-80 flex-col overflow-clip rounded-lg border border-solid border-charcoal-700 bg-comfy-menu-bg drop-shadow-[1px_1px_4px_rgba(0,0,0,0.4)]">
                <div class="flex items-center justify-between py-3.5 pr-3 pl-4">
                  <span class="text-[13px] font-semibold text-base-foreground">Active generations</span>
                  <span class="text-[11px] font-medium text-base-foreground">Cancel all</span>
                </div>
                <div class="flex flex-col gap-1.5 px-[9px] pb-[9px]">
                  <div class="relative flex flex-col gap-1 overflow-clip rounded-lg bg-secondary-background px-3 py-2">
                    <div class="flex items-center justify-between gap-2">
                      <span class="min-w-0 flex-1 truncate text-sm text-base-foreground">Add Product to Character's Hand</span>
                      <div class="flex shrink-0 items-center gap-2 text-text-secondary">
                        <i class="icon-[lucide--locate] size-4" />
                        <i class="icon-[comfy--stop] size-4" />
                      </div>
                    </div>
                    <span class="truncate text-xs text-muted-foreground">Running · {{ Math.round(percent) }}%</span>
                    <div
                      class="absolute bottom-0 left-0 h-px rounded-[1px] bg-base-foreground"
                      :style="{ width: Math.round(percent) + '%' }"
                    />
                  </div>
                </div>
              </div>
            </template>
          </ProcessToast>
        </div>

        <!-- Control bar -->
        <div class="flex flex-wrap items-center gap-2 border-t border-solid border-charcoal-700 bg-comfy-menu-bg px-3 py-2">
          <button
            class="cursor-pointer rounded-md border-none bg-base-foreground px-3 py-1.5 text-xs font-medium text-base-background"
            @click="playing = !playing"
          >
            {{ playing ? 'Pause' : 'Play' }}
          </button>

          <div class="mx-1 h-5 w-px bg-base-foreground/15" />

          <button
            v-for="(c, i) in cases"
            :key="c.name"
            class="cursor-pointer rounded-md border-none px-2.5 py-1.5 text-xs"
            :class="i === index ? 'bg-base-foreground text-base-background' : 'bg-secondary-background text-muted-foreground'"
            @click="select(i)"
          >
            {{ c.name }}
          </button>

          <div class="mx-1 h-5 w-px bg-base-foreground/15" />

          <button
            class="cursor-pointer rounded-md border-none px-2.5 py-1.5 text-xs"
            :class="expanded ? 'bg-base-foreground text-base-background' : 'bg-secondary-background text-muted-foreground'"
            @click="expanded = !expanded"
          >
            Panel
          </button>

          <span class="ml-auto text-xs tabular-nums text-muted-foreground">
            {{ Math.round(percent) }}%
          </span>
        </div>
      </div>
    `
  })
}
