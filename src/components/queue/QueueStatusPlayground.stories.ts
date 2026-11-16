import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, onBeforeUnmount, ref } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'

import QueueStatusIdle from './QueueStatusIdle.vue'
import QueueStatusPanel from './QueueStatusPanel.vue'
import QueueStatusPill from './QueueStatusPill.vue'
import { formatElapsed } from './queueStatusFormat'
import type {
  HeldReason,
  JobView,
  RecentResult,
  TerminalKind
} from './queueStatusTypes'

/**
 * Review playground: every parallel-execution case behind one button, with
 * live progress. Jobs tick on their own, Stop / Clear queue / Cancel all
 * really change the list, and a finished batch lands on its end chip.
 */

type SimJob = JobView & { startedAt: number; speed: number }

const HELD_COPY: Record<HeldReason, string> = {
  plan: "Waiting · your plan's run limit is full",
  partner: 'Waiting · partner node limit reached',
  provider: 'Waiting · the provider is busy'
}

const thumbnail = (hex: string) =>
  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><rect width='256' height='256' fill='%23${hex}'/></svg>`

const historyJob = (id: string, title: string): JobListItem => ({
  id,
  title,
  meta: 'Today',
  state: 'completed'
})

const RECENTS: RecentResult[] = [
  ['r1', 'Flux portrait', '4dabf7', false],
  ['r2', 'Video draft', '9775fa', true],
  ['r3', 'Inpaint test', '', false]
].map(([id, name, hex, isVideo]) => ({
  id: id as string,
  job: historyJob(id as string, name as string),
  name: name as string,
  meta: 'Completed · 2:43 PM',
  thumbSrc: hex ? thumbnail(hex as string) : undefined,
  isVideo: isVideo as boolean
}))

type Seed = {
  title: string
  status: JobView['status']
  progress?: number
  heldBy?: HeldReason
  speed?: number
}

type Case = {
  id: string
  group: string
  title: string
  check: string[]
  jobs: Seed[]
  open?: boolean
  limit?: number
  results?: boolean
  terminal?: TerminalKind
}

const CASES: Case[] = [
  {
    id: 'idle',
    group: 'Before a run',
    title: '1. Nothing running',
    check: [
      'The chip says "0 active".',
      'Click it: recent results open; each one opens its output.'
    ],
    jobs: [],
    results: true
  },
  {
    id: 'idle-empty',
    group: 'Before a run',
    title: '2. Nothing running, no history',
    check: ['Open the chip: it says "Nothing running yet".'],
    jobs: []
  },
  {
    id: 'one',
    group: 'Running',
    title: '3. One run',
    check: [
      'The pill says "Running" with its own line under it.',
      'The line moves as the run goes; at 100% the pill says "Completed".'
    ],
    jobs: [{ title: 'Flux portrait', status: 'running', progress: 30 }]
  },
  {
    id: 'several',
    group: 'Running',
    title: '4. Several at once',
    check: [
      'Closed: the pill says "Running 2" and two cards peek under it.',
      'Click the pill: one row per run, each with its own time and %.',
      'Queued rows come after running ones: "next up", then "#2".'
    ],
    jobs: [
      { title: 'Flux portrait', status: 'running', progress: 64, speed: 3 },
      { title: 'Upscale batch', status: 'running', progress: 12, speed: 5 },
      { title: 'Video draft', status: 'queued' },
      { title: 'Inpaint test', status: 'queued' }
    ],
    limit: 2
  },
  {
    id: 'held',
    group: 'Running',
    title: '5. Held by a limit',
    check: [
      'Waiting rows show an hourglass and name the limit.',
      'When a run finishes, the next waiting one starts.'
    ],
    jobs: [
      { title: 'Seedance shot 1', status: 'running', progress: 70 },
      { title: 'Seedance shot 2', status: 'running', progress: 40 },
      { title: 'Seedance shot 3', status: 'running', progress: 10 },
      { title: 'Seedance shot 4', status: 'held', heldBy: 'plan' },
      { title: 'Seedance shot 5', status: 'held', heldBy: 'partner' },
      { title: 'Seedance shot 6', status: 'held', heldBy: 'provider' }
    ],
    open: true,
    limit: 3
  },
  {
    id: 'failed-one',
    group: 'When something goes wrong',
    title: '6. One fails, others keep going',
    check: [
      'The failed row is red with "Details" and stays in the list.',
      'The other runs keep their own progress.',
      'Cancel all does not count the failed row.',
      'When the rest finish, the pill says "Failed".'
    ],
    jobs: [
      { title: 'Flux portrait', status: 'running', progress: 50 },
      { title: 'Upscale batch', status: 'running', progress: 20 },
      { title: 'Kling clip', status: 'failed' },
      { title: 'Video draft', status: 'queued' }
    ],
    open: true,
    limit: 2,
    results: true
  },
  {
    id: 'cancel',
    group: 'When something goes wrong',
    title: '7. Stop one, clear queue, cancel all',
    check: [
      'The square on a row stops only that run.',
      'Clear queue removes only the waiting rows.',
      'Cancel all turns red on hover and ends on "Cancelled".'
    ],
    jobs: [
      { title: 'Flux portrait', status: 'running', progress: 30, speed: 1 },
      { title: 'Upscale batch', status: 'running', progress: 10, speed: 1 },
      { title: 'Video draft', status: 'queued' },
      { title: 'Inpaint test', status: 'queued' },
      { title: 'Depth pass', status: 'queued' }
    ],
    open: true,
    limit: 2
  },
  {
    id: 'done',
    group: 'After a run',
    title: '8. Batch finished',
    check: ['Use the end buttons below to see each chip.'],
    jobs: [],
    terminal: 'completed',
    results: true
  }
]

const TERMINAL_LABEL: Record<TerminalKind, string> = {
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed'
}

function playground() {
  return {
    components: { QueueStatusPill, QueueStatusPanel, QueueStatusIdle },
    setup() {
      const caseId = ref(CASES[0].id)
      const jobs = ref<SimJob[]>([])
      const limit = ref(2)
      const open = ref(false)
      const idleOpen = ref(false)
      const withResults = ref(false)
      const terminal = ref<TerminalKind | null>(null)
      const paused = ref(false)
      const now = ref(Date.now())
      const log = ref<string[]>([])
      let seq = 0

      const current = computed(
        () => CASES.find((c) => c.id === caseId.value) ?? CASES[0]
      )
      const groups = computed(() =>
        [...new Set(CASES.map((c) => c.group))].map((group) => ({
          group,
          cases: CASES.filter((c) => c.group === group)
        }))
      )

      function note(message: string) {
        log.value = [message, ...log.value].slice(0, 6)
      }

      function makeJob(seed: Seed): SimJob {
        seq += 1
        return {
          id: `j${seq}`,
          title: seed.title,
          status: seed.status,
          progress: seed.progress ?? 0,
          queuePosition: 0,
          heldBy: seed.heldBy,
          startedAt: Date.now() - (seed.progress ?? 0) * 900,
          speed: seed.speed ?? 2
        }
      }

      function load(c: Case) {
        caseId.value = c.id
        seq = 0
        jobs.value = c.jobs.map(makeJob)
        limit.value = c.limit ?? Math.max(1, c.jobs.length)
        open.value = c.open ?? false
        idleOpen.value = c.jobs.length === 0 && !c.terminal
        withResults.value = c.results ?? false
        terminal.value = c.terminal ?? null
        paused.value = false
        log.value = []
      }

      const active = computed(() =>
        jobs.value.filter((j) => j.status !== 'failed')
      )
      const runningJobs = computed(() =>
        jobs.value.filter((j) => j.status === 'running')
      )
      const waitingJobs = computed(() =>
        jobs.value.filter((j) => j.status === 'queued' || j.status === 'held')
      )

      function startNext() {
        while (runningJobs.value.length < limit.value) {
          const next = waitingJobs.value[0]
          if (!next) return
          next.status = 'running'
          next.heldBy = undefined
          next.startedAt = Date.now()
          note(`${next.title} started`)
        }
      }

      function settle() {
        if (active.value.length > 0 || terminal.value) return
        if (jobs.value.length === 0) return
        const failed = jobs.value.some((j) => j.status === 'failed')
        terminal.value = failed ? 'failed' : 'completed'
        withResults.value = true
        jobs.value = []
        open.value = false
      }

      const timer = setInterval(() => {
        now.value = Date.now()
        if (paused.value || terminal.value) return
        for (const job of runningJobs.value) {
          job.progress = Math.min(100, job.progress + job.speed)
          if (job.progress >= 100) {
            note(`${job.title} finished`)
            jobs.value = jobs.value.filter((j) => j.id !== job.id)
          }
        }
        startNext()
        settle()
      }, 400)
      onBeforeUnmount(() => clearInterval(timer))

      const rows = computed(() => {
        let position = 0
        return [...jobs.value]
          .sort((a, b) => order(a) - order(b))
          .map((job) => {
            const waiting = job.status === 'queued' || job.status === 'held'
            if (waiting) position += 1
            const view: JobView = { ...job, queuePosition: position }
            return { job: view, subtitle: subtitle(job, position) }
          })
      })

      function order(job: SimJob) {
        return { running: 0, failed: 1, held: 2, queued: 3 }[job.status]
      }

      function subtitle(job: SimJob, position: number) {
        if (job.status === 'running')
          return `${formatElapsed(now.value - job.startedAt)} · ${Math.round(job.progress)}%`
        if (job.status === 'failed') return 'Failed · other runs keep going'
        if (job.status === 'held' && job.heldBy) return HELD_COPY[job.heldBy]
        return position === 1 ? 'Queued · next up' : `Queued · #${position}`
      }

      const queuedCount = computed(() => waitingJobs.value.length)
      const pillLabel = computed(() => {
        if (terminal.value) return TERMINAL_LABEL[terminal.value]
        const count = runningJobs.value.length
        if (count === 0) return 'Queued'
        return count === 1 ? 'Running' : `Running ${count}`
      })
      const badge = computed(() =>
        queuedCount.value > 0 && !terminal.value
          ? `Queued ${queuedCount.value}`
          : undefined
      )
      const progress = computed(() =>
        runningJobs.value.length === 1
          ? runningJobs.value[0].progress
          : undefined
      )
      const stack = computed(() =>
        open.value ? 0 : Math.min(2, Math.max(0, active.value.length - 1))
      )
      const showIdle = computed(
        () => jobs.value.length === 0 && !terminal.value
      )
      const results = computed(() => (withResults.value ? RECENTS : []))

      function cancel(job: JobView) {
        jobs.value = jobs.value.filter((j) => j.id !== job.id)
        note(`Stopped ${job.title}`)
        startNext()
        if (active.value.length === 0 && jobs.value.length === 0) {
          terminal.value = 'cancelled'
          open.value = false
        }
      }

      function clearQueue() {
        jobs.value = jobs.value.filter(
          (j) => j.status === 'running' || j.status === 'failed'
        )
        note('Cleared the queue')
      }

      function cancelAll() {
        jobs.value = []
        terminal.value = 'cancelled'
        open.value = false
        note('Cancelled all')
      }

      function addRun() {
        terminal.value = null
        jobs.value.push(
          makeJob({ title: `New run ${seq + 1}`, status: 'queued' })
        )
        note('Added a run')
        startNext()
      }

      function failOne() {
        const job = runningJobs.value[0]
        if (!job) return
        job.status = 'failed'
        note(`${job.title} failed`)
        startNext()
      }

      function holdOne(reason: HeldReason) {
        terminal.value = null
        jobs.value.push(
          makeJob({
            title: `Held run ${seq + 1}`,
            status: 'held',
            heldBy: reason
          })
        )
        limit.value = runningJobs.value.length || 1
        note(`Added a run held by the ${reason} limit`)
      }

      function endAs(kind: TerminalKind) {
        jobs.value = []
        terminal.value = kind
        open.value = false
      }

      function togglePill() {
        if (terminal.value) {
          terminal.value = null
          idleOpen.value = true
          return
        }
        open.value = !open.value
      }

      load(CASES[0])

      return {
        groups,
        current,
        load,
        rows,
        queuedCount,
        pillLabel,
        badge,
        progress,
        stack,
        open,
        idleOpen,
        showIdle,
        results,
        terminal,
        paused,
        log,
        cancel,
        clearQueue,
        cancelAll,
        addRun,
        failOne,
        holdOne,
        endAs,
        togglePill
      }
    },
    template: `
      <div class="flex min-h-[640px] gap-6 text-sm text-base-foreground">
        <nav class="flex w-60 shrink-0 flex-col gap-4">
          <div v-for="g in groups" :key="g.group" class="flex flex-col gap-1">
            <div class="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{{ g.group }}</div>
            <button
              v-for="c in g.cases"
              :key="c.id"
              type="button"
              class="rounded-lg px-3 py-2 text-left transition-colors hover:bg-foreground/10"
              :class="c.id === current.id ? 'bg-foreground/10 font-medium' : 'text-muted-foreground'"
              :data-testid="'case-' + c.id"
              @click="load(c)"
            >{{ c.title }}</button>
          </div>
        </nav>

        <main class="flex min-w-0 flex-1 flex-col gap-4">
          <section class="rounded-xl bg-foreground/5 p-4">
            <div class="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">What to check</div>
            <div class="mt-1 text-base font-semibold">{{ current.title }}</div>
            <ul class="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
              <li v-for="line in current.check" :key="line">{{ line }}</li>
            </ul>
          </section>

          <section class="flex flex-wrap items-center gap-2">
            <div class="mr-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Try</div>
            <button type="button" class="rounded-md bg-foreground/10 px-2.5 py-1 hover:bg-foreground/15" @click="addRun">Add a run</button>
            <button type="button" class="rounded-md bg-foreground/10 px-2.5 py-1 hover:bg-foreground/15" @click="failOne">Make one fail</button>
            <button type="button" class="rounded-md bg-foreground/10 px-2.5 py-1 hover:bg-foreground/15" @click="holdOne('plan')">Hold: plan</button>
            <button type="button" class="rounded-md bg-foreground/10 px-2.5 py-1 hover:bg-foreground/15" @click="holdOne('partner')">Hold: partner</button>
            <button type="button" class="rounded-md bg-foreground/10 px-2.5 py-1 hover:bg-foreground/15" @click="holdOne('provider')">Hold: provider</button>
            <button type="button" class="rounded-md bg-foreground/10 px-2.5 py-1 hover:bg-foreground/15" @click="paused = !paused">{{ paused ? 'Resume' : 'Pause' }}</button>
            <button type="button" class="rounded-md bg-foreground/10 px-2.5 py-1 hover:bg-foreground/15" @click="endAs('completed')">End: completed</button>
            <button type="button" class="rounded-md bg-foreground/10 px-2.5 py-1 hover:bg-foreground/15" @click="endAs('cancelled')">End: cancelled</button>
            <button type="button" class="rounded-md bg-foreground/10 px-2.5 py-1 hover:bg-foreground/15" @click="endAs('failed')">End: failed</button>
          </section>

          <section class="relative flex min-h-[420px] items-start justify-end rounded-xl bg-base-background p-6">
            <QueueStatusIdle
              v-if="showIdle"
              v-model:open="idleOpen"
              label="0 active"
              :results="results"
            />
            <div v-else class="relative flex flex-col items-end gap-1">
              <QueueStatusPill
                :label="pillLabel"
                :badge="badge"
                :progress="progress"
                :expanded="open"
                :terminal-kind="terminal"
                @activate="togglePill"
                @stop="cancelAll"
              />
              <QueueStatusPanel
                v-if="open && !terminal"
                :rows="rows"
                :queued-count="queuedCount"
                @cancel="cancel"
                @clear-queue="clearQueue"
                @cancel-all="cancelAll"
              />
            </div>
          </section>

          <section v-if="log.length" class="text-xs text-muted-foreground">
            <span class="font-medium tracking-wider uppercase">Last actions · </span>{{ log.join(' · ') }}
          </section>
        </main>
      </div>
    `
  }
}

const meta: Meta = {
  title: 'Queue/Review playground',
  parameters: { layout: 'padded' }
}

export default meta

export const AllCases: StoryObj = { name: 'All cases', render: playground }
