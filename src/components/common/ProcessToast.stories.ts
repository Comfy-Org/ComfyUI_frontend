import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

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
 * Full-bleed demo with a control bar docked at the bottom. Each case carries
 * the panel rows it would really have, so the expanded view stays truthful:
 * a finished run shows no active work, a failure shows the failure.
 *
 * The backend rarely reaches these states on demand, so this is where they
 * get reviewed and shown.
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

      type Row = {
        title: string
        meta: string
        /** null renders no progress rule, as for queued and finished work */
        percent: number | null
        /** Tracks the demo clock instead of a fixed percent */
        live?: boolean
      }
      type Case = {
        name: string
        verb: string
        percent?: number | null
        status?: 'progress' | 'done' | 'failed'
        failedCount?: number
        showPercentText?: boolean
        ticks?: boolean
        stoppable?: boolean
        thumbnailUrl?: string
        showThumbnailPlaceholder?: boolean
        rows: Row[]
      }

      const WORKFLOW = "Add Product to Character's Hand"

      const cases: Case[] = [
        {
          name: 'Queued',
          verb: 'Queued 3',
          percent: null,
          rows: [
            { title: WORKFLOW, meta: 'In queue...', percent: null },
            { title: WORKFLOW, meta: 'In queue...', percent: null },
            { title: WORKFLOW, meta: 'In queue...', percent: null }
          ]
        },
        {
          name: 'Starting',
          verb: 'Starting',
          percent: null,
          rows: [{ title: WORKFLOW, meta: 'Starting', percent: null }]
        },
        {
          name: 'Running',
          verb: 'Running',
          percent: 0,
          ticks: true,
          stoppable: true,
          rows: [{ title: WORKFLOW, meta: 'Running', percent: 0, live: true }]
        },
        {
          name: 'Parallel 3/7',
          verb: 'Running 3/7',
          percent: 0,
          ticks: true,
          showPercentText: false,
          stoppable: true,
          rows: [
            { title: WORKFLOW, meta: 'Running', percent: 0, live: true },
            { title: 'Upscale to 4K', meta: 'Running', percent: 68 },
            { title: 'Relight product shot', meta: 'Running', percent: 24 },
            { title: 'Background swap', meta: 'In queue...', percent: null },
            { title: 'Add reflections', meta: 'In queue...', percent: null }
          ]
        },
        {
          name: 'With failures',
          verb: 'Running',
          percent: 62,
          failedCount: 2,
          stoppable: true,
          rows: [
            { title: WORKFLOW, meta: 'Running · 62%', percent: 62 },
            { title: 'Upscale to 4K', meta: 'Failed', percent: null },
            { title: 'Relight product shot', meta: 'Failed', percent: null }
          ]
        },
        {
          name: 'Completed',
          verb: 'Completed',
          status: 'done',
          thumbnailUrl:
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%230b8ce9"/><stop offset="1" stop-color="%23b33a3a"/></linearGradient></defs><rect width="48" height="48" fill="url(%23g)"/></svg>'
            ),
          rows: []
        },
        {
          name: 'Completed (no preview)',
          verb: 'Completed',
          status: 'done',
          showThumbnailPlaceholder: true,
          rows: []
        },
        {
          name: 'Failed',
          verb: 'Failed',
          status: 'failed',
          rows: [{ title: WORKFLOW, meta: 'Failed', percent: null }]
        }
      ]

      const index = ref(0)
      const percent = ref(0)
      const playing = ref(false)
      const expanded = ref(true)
      const stopped = ref(false)
      const current = computed(() => cases[index.value])
      // Rows are a working copy so cancelling one actually removes it
      const rows = ref<Row[]>([...cases[0].rows])

      const TICK_MS = 100
      let timer: ReturnType<typeof setInterval> | undefined
      let heldMs = 0

      const select = (i: number) => {
        index.value = i
        percent.value = 0
        heldMs = 0
        stopped.value = false
        rows.value = cases[i].rows.map((row) => ({ ...row }))
      }
      const advance = () => select((index.value + 1) % cases.length)

      const onTick = () => {
        if (stopped.value) return
        const step = current.value
        if (step.ticks) {
          // A full 0-100 sweep spans runSeconds, slow enough to watch
          percent.value = Math.min(
            100,
            percent.value + (100 * TICK_MS) / (runSeconds.value * 1000)
          )
          if (playing.value && percent.value >= 100) advance()
          return
        }
        if (!playing.value) return
        heldMs += TICK_MS
        if (heldMs >= holdSeconds.value * 1000) advance()
      }

      onMounted(() => {
        timer = setInterval(onTick, TICK_MS)
      })
      onBeforeUnmount(() => clearInterval(timer))

      const rowPercent = (row: Row) =>
        row.live ? Math.round(percent.value) : row.percent
      const rowMeta = (row: Row) =>
        row.live ? `Running · ${Math.round(percent.value)}%` : row.meta

      const runningRows = computed(
        () => rows.value.filter((row) => row.meta.startsWith('Running')).length
      )

      /**
       * One run stops outright. Several would mean silently taking them all
       * down, so the panel opens and the choice becomes explicit.
       */
      const stopRun = () => {
        if (runningRows.value > 1) {
          expanded.value = true
          return
        }
        stopped.value = true
        playing.value = false
        rows.value = []
      }
      /** Cancel all is unambiguous by name, so it clears everything. */
      const cancelAll = () => {
        stopped.value = true
        playing.value = false
        rows.value = []
      }
      const cancelRow = (i: number) => {
        rows.value.splice(i, 1)
        if (!rows.value.length) cancelAll()
      }

      return {
        cases,
        index,
        percent,
        playing,
        expanded,
        stopped,
        rows,
        current,
        select,
        stopRun,
        cancelAll,
        runningRows,
        cancelRow,
        rowPercent,
        rowMeta
      }
    },
    template: `
      <div class="relative flex h-screen flex-col bg-charcoal-900">
        <div class="flex flex-1 items-start justify-end overflow-auto p-6">
          <!-- Stopped means the queue drained, so the app falls back to the
               idle pill; the demo has to do the same or the frozen toast
               reads as a stop that did nothing. -->
          <button
            v-if="stopped"
            class="flex h-6 cursor-pointer items-center rounded-md border border-solid border-base-foreground/40 bg-transparent px-2 text-xs text-base-foreground opacity-50"
            @click="select(index)"
          >
            0 active
          </button>
          <ProcessToast
            v-else
            :verb="current.verb"
            :percent="current.ticks ? Math.round(percent) : (current.percent ?? null)"
            :status="current.status ?? 'progress'"
            :failed-count="current.failedCount ?? 0"
            :show-percent-text="current.showPercentText ?? true"
            :hide-action="!current.stoppable || (runningRows > 1 && expanded)"
            :thumbnail-url="current.thumbnailUrl ?? null"
            :show-thumbnail-placeholder="current.showThumbnailPlaceholder ?? false"
            :interactive="current.status === 'done'"
            :expanded="expanded && current.status === undefined"
            @toggle-expand="expanded = !expanded"
            @activate="alert('Opens the assets panel')"
          >
            <template #action>
              <button
                class="flex size-4 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-base-foreground"
                :title="runningRows > 1 ? 'Choose which run to stop' : 'Stop run'"
                @click="stopRun"
              >
                <i class="icon-[comfy--stop] size-4" />
              </button>
            </template>

            <template #panel>
              <div class="mt-1 flex w-80 flex-col overflow-clip rounded-lg border border-solid border-charcoal-700 bg-comfy-menu-bg drop-shadow-[1px_1px_4px_rgba(0,0,0,0.4)]">
                <div class="flex items-center justify-between py-3.5 pr-3 pl-4">
                  <span class="text-[13px] font-semibold text-base-foreground">Active generations</span>
                  <span
                    v-if="rows.length"
                    class="cursor-pointer text-[11px] font-medium text-base-foreground"
                    @click="cancelAll"
                  >Cancel all</span>
                </div>
                <div class="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto px-[9px] pb-[9px]">
                  <div
                    v-for="(row, i) in rows"
                    :key="row.title + i"
                    class="relative flex flex-col gap-1 overflow-clip rounded-lg bg-secondary-background px-3 py-2"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="min-w-0 flex-1 truncate text-sm text-base-foreground">{{ row.title }}</span>
                      <div class="flex shrink-0 items-center gap-2 text-text-secondary">
                        <i class="icon-[comfy--pause] size-4 opacity-40" title="Pause (no API yet)" />
                        <i
                          class="icon-[comfy--stop] size-4 cursor-pointer"
                          title="Stop this run"
                          @click="cancelRow(i)"
                        />
                      </div>
                    </div>
                    <span class="truncate text-xs text-muted-foreground">{{ rowMeta(row) }}</span>
                    <div
                      v-if="rowPercent(row) !== null"
                      class="absolute bottom-0 left-0 h-px rounded-[1px] bg-base-foreground"
                      :style="{ width: rowPercent(row) + '%' }"
                    />
                  </div>
                  <p v-if="!rows.length" class="px-2 py-4 text-center text-xs text-muted-foreground">
                    Nothing running yet
                  </p>
                </div>
              </div>
            </template>
          </ProcessToast>
        </div>

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
            class="cursor-pointer rounded-md border-none px-2.5 py-1.5 text-xs disabled:opacity-40"
            :class="expanded ? 'bg-base-foreground text-base-background' : 'bg-secondary-background text-muted-foreground'"
            :disabled="current.status !== undefined"
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
