import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'

import QueueStatusIdle from './QueueStatusIdle.vue'
import QueueStatusPanel from './QueueStatusPanel.vue'
import QueueStatusPill from './QueueStatusPill.vue'
import type { JobView, RecentResult, TerminalKind } from './queueStatusTypes'

type QueueStatusArgs = {
  label: string
  badge?: string
  progress?: number
  terminalKind?: TerminalKind | null
  stack?: number
  panelOpen?: boolean
  rows?: { job: JobView; subtitle: string }[]
  queuedCount?: number
  results?: RecentResult[]
}

const meta: Meta<QueueStatusArgs> = {
  title: 'Queue/QueueStatus',
  parameters: { layout: 'padded' },
  render: (args) => ({
    components: { QueueStatusPill, QueueStatusPanel },
    setup: () => ({ args }),
    template: `
      <div class="flex min-h-64 items-start justify-end">
        <div class="relative flex flex-col items-end gap-1">
          <QueueStatusPill
            :label="args.label"
            :badge="args.badge"
            :progress="args.progress"
            :expanded="args.panelOpen"
            :terminal-kind="args.terminalKind"
            :stack="args.stack"
          />
          <QueueStatusPanel
            v-if="args.panelOpen"
            :rows="args.rows ?? []"
            :queued-count="args.queuedCount ?? 0"
            :results="args.results ?? []"
          />
        </div>
      </div>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

const job = (
  id: string,
  title: string,
  status: JobView['status'],
  progress = 0,
  queuePosition = 0
): JobView => ({ id, title, status, progress, queuePosition })

const running = [
  { job: job('a', 'Flux portrait', 'running', 64), subtitle: '14:02:11 · 64%' },
  { job: job('b', 'Upscale batch', 'running', 12), subtitle: '14:02:40 · 12%' }
]
const queued = [
  {
    job: job('c', 'Video draft', 'queued', 0, 1),
    subtitle: 'Queued · next up'
  },
  { job: job('d', 'Inpaint test', 'queued', 0, 2), subtitle: 'Queued · #2' }
]

export const Queued: Story = {
  args: { label: 'Queued' }
}

export const Running: Story = {
  args: { label: 'Running', progress: 64 }
}

export const RunningWithQueue: Story = {
  args: { label: 'Running', badge: 'Queued 2', progress: 64 }
}

export const ParallelCollapsed: Story = {
  args: { label: 'Running 2', badge: 'Queued 2', stack: 2 }
}

export const Completed: Story = {
  args: { label: 'Completed', terminalKind: 'completed' }
}

export const Cancelled: Story = {
  args: { label: 'Cancelled', terminalKind: 'cancelled' }
}

export const Failed: Story = {
  args: { label: 'Failed', terminalKind: 'failed' }
}

const thumbnail = (hex: string) =>
  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><rect width='256' height='256' fill='%23${hex}'/></svg>`

const historyJob = (id: string, title: string): JobListItem => ({
  id,
  title,
  meta: 'Today',
  state: 'completed'
})

const recentResults: RecentResult[] = [
  {
    id: 'r1',
    job: historyJob('r1', 'Flux portrait'),
    name: 'Flux portrait',
    meta: 'Completed · 2:43 PM',
    thumbSrc: thumbnail('4dabf7'),
    isVideo: false
  },
  {
    id: 'r2',
    job: historyJob('r2', 'Video draft'),
    name: 'Video draft',
    meta: 'Completed · 2:43 PM',
    thumbSrc: thumbnail('9775fa'),
    isVideo: true
  },
  {
    id: 'r3',
    job: historyJob('r3', 'Inpaint test'),
    name: 'Inpaint test',
    meta: 'Completed · 2:43 PM',
    isVideo: false
  }
]

export const ParallelFannedOut: Story = {
  args: {
    label: 'Running 2',
    badge: 'Queued 2',
    panelOpen: true,
    rows: [...running, ...queued],
    queuedCount: 2,
    results: recentResults
  }
}

type IdleArgs = { label: string; results: RecentResult[]; open: boolean }

const idle = (args: IdleArgs) => ({
  components: { QueueStatusIdle },
  setup: () => ({ args, open: ref(args.open) }),
  template: `
    <div class="flex min-h-80 items-start justify-end">
      <QueueStatusIdle v-model:open="open" :label="args.label" :results="args.results" />
    </div>
  `
})

export const Idle: StoryObj<IdleArgs> = {
  args: { label: '0 active', results: recentResults, open: false },
  render: idle
}

export const IdleOpen: StoryObj<IdleArgs> = {
  args: { label: '0 active', results: recentResults, open: true },
  render: idle
}

export const IdleEmpty: StoryObj<IdleArgs> = {
  args: { label: '0 active', results: [], open: true },
  render: idle
}
