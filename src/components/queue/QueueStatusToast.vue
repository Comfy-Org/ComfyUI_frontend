<template>
  <!-- Idle pill and status toast trade places. This swap is deliberately not a
       <Transition>: Vue drives one with requestAnimationFrame, which a
       background tab pauses, and a swap stuck mid-flight leaves a run with no
       visible status at all. A one-shot enter animation can't wedge. -->
  <div
    v-if="toastView"
    data-testid="queue-status-toast"
    :class="
      cn(
        'pointer-events-auto flex animate-in items-end gap-1 fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none',
        // Docked at the bottom, the panel opens upward so it grows into the
        // canvas, not off the bottom edge.
        dockEdge === 'bottom' ? 'flex-col-reverse' : 'flex-col'
      )
    "
  >
    <!-- hide-chevron stays off: dropping the slab whenever the job list is
         momentarily empty would resize the pill mid-run. -->
    <ProcessToast
      :verb="toastView.verb"
      :percent="toastView.percent"
      :status="toastView.status"
      :failed-count="failedCount"
      :expanded="expanded"
      :hide-action="hidePillAction"
      :show-percent-text="toastView.showPercentText"
      :thumbnail-url="toastView.thumbnailUrl"
      :show-thumbnail-placeholder="toastView.showThumbnailPlaceholder"
      :interactive="toastView.status === 'done'"
      progress-class="bg-base-foreground"
      @toggle-expand="expanded = !expanded"
      @activate="openAssets"
    >
      <template #action>
        <!-- Failed hands off to the existing error panel; running shows stop. -->
        <button
          v-if="toastView.status === 'failed'"
          type="button"
          class="flex shrink-0 cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-sm font-normal whitespace-nowrap text-destructive-background hover:underline"
          data-testid="queue-status-resolve"
          @click="resolveErrors"
        >
          {{ t('queueStatus.resolveErrors') }}
          <i class="icon-[lucide--arrow-right] size-3.5" />
        </button>
        <button
          v-else
          v-tooltip.bottom="stopTooltip"
          type="button"
          class="flex size-4 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-base-foreground opacity-90 transition-opacity hover:opacity-100"
          :aria-label="t('processToast.stop')"
          data-testid="queue-status-stop"
          @click="onStopClick"
        >
          <i class="icon-[comfy--stop] size-4" />
        </button>
      </template>
    </ProcessToast>

    <div
      v-if="expanded"
      data-testid="queue-status-panel"
      class="flex w-80 flex-col overflow-clip rounded-lg border border-solid border-charcoal-700 bg-comfy-menu-bg drop-shadow-[1px_1px_4px_rgba(0,0,0,0.4)]"
    >
      <div class="flex shrink-0 items-center justify-between py-3.5 pr-3 pl-4">
        <span class="text-[13px] font-semibold text-base-foreground">
          {{ t('queueStatus.activeGenerations') }}
        </span>
        <button
          v-if="activeJobs.length > 0"
          type="button"
          class="cursor-pointer border-none bg-transparent text-[11px] font-medium text-base-foreground"
          data-testid="queue-status-cancel-all"
          @click="cancelAll"
        >
          {{ t('queueStatus.cancelAll') }}
        </button>
      </div>

      <div
        class="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto px-[9px] pb-[9px]"
      >
        <!-- Running: full cards, selectable. Clicking one makes it the job the
             pill and canvas track. The focused one is marked. -->
        <button
          v-for="job in runningJobs"
          :key="job.id"
          type="button"
          data-testid="queue-status-row"
          :class="
            cn(
              'group relative flex cursor-pointer flex-col gap-1 overflow-clip rounded-lg border border-solid bg-secondary-background px-3 py-2 text-left',
              job.id === focusedJob?.id
                ? 'border-base-foreground/30'
                : 'border-transparent hover:border-base-foreground/15'
            )
          "
          @click="focusJob(job)"
        >
          <div class="flex items-center justify-between gap-2">
            <span
              class="min-w-0 flex-1 truncate text-sm font-normal text-base-foreground"
            >
              {{ job.title }}
            </span>
            <div class="flex shrink-0 items-center gap-2">
              <!-- The focused job carries a locate marker; it steps aside for
                   the row actions, which only surface on hover. -->
              <i
                v-if="job.id === focusedJob?.id"
                v-tooltip.bottom="onCanvasTooltip"
                class="icon-[lucide--locate] size-4 text-text-secondary group-hover:hidden"
                data-testid="queue-status-row-oncanvas"
              />
              <div class="hidden items-center gap-2 group-hover:flex">
                <button
                  v-tooltip.bottom="pauseTooltip"
                  type="button"
                  class="flex size-4 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-text-secondary disabled:opacity-40"
                  :aria-label="t('queueStatus.pause')"
                  data-testid="queue-status-row-pause"
                  disabled
                  @click.stop
                >
                  <i class="icon-[comfy--pause] size-4" />
                </button>
                <button
                  v-tooltip.bottom="cancelTooltip"
                  type="button"
                  class="flex size-4 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-text-secondary"
                  :aria-label="t('queueStatus.cancel')"
                  data-testid="queue-status-row-cancel"
                  @click.stop="cancelJob(job)"
                >
                  <i class="icon-[comfy--stop] size-4" />
                </button>
              </div>
            </div>
          </div>

          <span class="truncate text-xs text-muted-foreground">
            {{ jobSubtitle(job) }}
          </span>

          <!-- Progress hugs the row's bottom edge, as it does on the pill -->
          <div
            class="absolute bottom-0 left-0 h-px rounded-[1px] bg-base-foreground transition-[width] duration-200 ease-out"
            :style="{ width: `${jobPercent(job)}%` }"
          />
        </button>

        <!-- Queue is a separate, lighter treatment so it never crowds the runs.
             No progress, just position and a way to drop it. -->
        <template v-if="queuedJobs.length">
          <p
            class="px-1 pt-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
          >
            {{ t('queueStatus.queueHeading', { count: queuedJobs.length }) }}
          </p>
          <div
            v-for="(job, index) in queuedJobs"
            :key="job.id"
            data-testid="queue-status-queued-row"
            class="group flex items-center justify-between gap-2 rounded-lg px-3 py-1.5"
          >
            <span class="flex min-w-0 flex-1 items-center gap-2">
              <span class="text-xs tabular-nums text-muted-foreground"
                >{{ index + 1 }}</span
              >
              <span class="min-w-0 flex-1 truncate text-sm text-text-secondary">
                {{ job.title }}
              </span>
            </span>
            <button
              v-tooltip.bottom="cancelTooltip"
              type="button"
              class="hidden size-4 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-text-secondary group-hover:flex"
              :aria-label="t('queueStatus.cancel')"
              data-testid="queue-status-queued-cancel"
              @click="cancelJob(job)"
            >
              <i class="icon-[lucide--x] size-4" />
            </button>
          </div>
        </template>

        <p
          v-if="!activeJobs.length"
          class="px-2 py-4 text-center text-xs text-muted-foreground"
        >
          {{ t('queueStatus.nothingRunning') }}
        </p>
      </div>
    </div>
  </div>

  <!-- Idle: nothing queued, running or recently finished -->
  <div
    v-else
    class="flex animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none"
  >
    <Popover>
      <PopoverTrigger as-child>
        <!-- The chevron is what tells people this opens something; without it
             "0 active" reads as a bare status label, not a control. -->
        <button
          type="button"
          data-testid="queue-status-idle"
          class="group pointer-events-auto flex cursor-pointer items-center gap-1 rounded-lg border border-solid border-[#2d2e32] bg-transparent px-2 py-1 text-sm leading-5 text-base-foreground transition-colors hover:bg-[#232426] data-[state=open]:bg-[#232426]"
        >
          {{ activeJobsLabel }}
          <i
            class="icon-[lucide--chevron-down] size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        :side-offset="8"
        data-testid="queue-status-idle-panel"
        class="flex w-[326px] flex-col items-center gap-3 rounded-lg border-none bg-comfy-menu-bg px-0 py-3 shadow-none drop-shadow-[1px_1px_4px_rgba(0,0,0,0.4)]"
      >
        <!-- Idle is exactly when someone goes looking for what they just
             made, so recent runs are here rather than a tab away. Figma
             node 2640-40346. -->
        <div class="flex w-full flex-col gap-3 px-3">
          <div class="flex items-center justify-between">
            <span class="text-[13px] font-semibold text-base-foreground">
              {{ t('queueStatus.recentResults') }}
            </span>
            <button
              v-tooltip.bottom="viewHistoryTooltip"
              type="button"
              class="flex size-3.5 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground"
              :aria-label="t('queueStatus.goToHistory')"
              data-testid="queue-status-filter"
              @click="goToHistory"
            >
              <i class="icon-[lucide--list-filter] size-3.5" />
            </button>
          </div>

          <template v-if="recentJobs.length">
            <button
              v-for="job in recentJobs"
              :key="job.id"
              type="button"
              class="relative flex h-11 cursor-pointer items-center gap-2 overflow-clip rounded-[10px] border-none bg-[#1c1c1d] py-1.5 pr-1.5 pl-2.5 text-left transition-colors hover:bg-[#232426]"
              :aria-label="t('queueStatus.viewResult')"
              data-testid="queue-status-recent-job"
              @click="openRecentJob(job)"
            >
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="truncate text-[13px] font-normal text-base-foreground">
                  {{ recentJobName(job) }}
                </span>
                <span class="truncate text-xs text-[#8a8a8a]">
                  {{ recentJobMeta(job) }}
                </span>
              </span>
              <!-- Thumbnail only when the run produced one; no empty tile. -->
              <span
                v-if="jobThumbnail(job)"
                class="relative flex size-[41px] shrink-0 items-center justify-center overflow-clip rounded-lg bg-comfy-menu-bg outline-1 outline-base-foreground/10"
              >
                <img
                  :src="jobThumbnail(job)!.previewUrl"
                  alt=""
                  loading="lazy"
                  class="size-full object-cover"
                />
                <i
                  v-if="jobThumbnail(job)?.isVideo"
                  class="icon-[lucide--play] absolute right-0.5 bottom-0.5 size-2.5 text-base-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                />
              </span>
            </button>
          </template>
          <p v-else class="py-2 text-center text-xs text-muted-foreground">
            {{ t('queueStatus.nothingRunning') }}
          </p>
        </div>

        <div class="h-px w-full bg-base-foreground/10" />

        <div class="w-full px-3">
          <Button
            variant="secondary"
            size="unset"
            class="h-8 w-full gap-1.5 rounded-lg text-sm font-medium"
            data-testid="queue-status-go-history"
            @click="goToHistory"
          >
            <i class="icon-[lucide--history] size-4 shrink-0" />
            {{ t('queueStatus.goToHistory') }}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  </div>

  <MediaLightbox
    v-model:active-index="galleryActiveIndex"
    :all-gallery-items="galleryItems"
  />

  <!-- Dev-only state driver (?toastDemo=1). Not part of the shipped UI. -->
  <Teleport to="body">
    <div
      v-if="isDemo"
      class="pointer-events-auto fixed bottom-3 left-1/2 z-[3000] flex -translate-x-1/2 items-center gap-1 rounded-lg border border-solid border-charcoal-700 bg-comfy-menu-bg p-1 shadow-interface"
    >
      <span class="px-2 text-[11px] text-muted-foreground">Toast demo</span>
      <button
        v-for="state in demoStates"
        :key="state.name"
        type="button"
        class="cursor-pointer rounded-md border-none px-2.5 py-1.5 text-xs"
        :class="
          demoSelected === state
            ? 'bg-base-foreground text-base-background'
            : 'bg-secondary-background text-muted-foreground'
        "
        @click="demoSelected = state"
      >
        {{ state.name }}
      </button>
      <span class="mx-1 h-5 w-px bg-base-foreground/15" />
      <button
        type="button"
        class="cursor-pointer rounded-md border-none bg-secondary-background px-2.5 py-1.5 text-xs text-muted-foreground"
        @click="dockEdge = dockEdge === 'top' ? 'bottom' : 'top'"
      >
        Dock: {{ dockEdge }}
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { PopoverTrigger } from 'reka-ui'

import ProcessToast from '@/components/common/ProcessToast.vue'
import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { useJobList } from '@/composables/queue/useJobList'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useQueueNotificationBanners } from '@/composables/queue/useQueueNotificationBanners'
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useResultGallery } from '@/composables/queue/useResultGallery'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import type { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'
import { useQueueStore } from '@/stores/queueStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t, n } = useI18n()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const { totalPercent } = useQueueProgress()
const { jobItems } = useJobList()

const sidebarTabStore = useSidebarTabStore()
const rightSidePanelStore = useRightSidePanelStore()

const expanded = ref(false)

/**
 * Which edge the run bar is anchored to, remembered across sessions. Drives
 * the panel's open direction; the bar's drag-to-anchor lives in ComfyActionbar.
 */
const dockEdge = useLocalStorage<'top' | 'bottom'>(
  'Comfy.QueueToast.DockEdge',
  'top'
)

/** Open the full job history in the right-side panel (with its filters). */
const goToHistory = () => {
  rightSidePanelStore.openPanel('job-history')
}

/**
 * After a run, the output lands in the assets panel on the far side of the
 * screen and people don't find it. Clicking the completed chip opens it.
 */
const openAssets = () => {
  sidebarTabStore.toggleSidebarTab('assets')
}

/** A failed run hands off to the existing error panel rather than self-resolve. */
const resolveErrors = () => {
  rightSidePanelStore.openPanel('errors')
}

const runningCount = computed(() => queueStore.runningTasks.length)
const pendingCount = computed(() => queueStore.pendingTasks.length)
const isExecuting = computed(() => !executionStore.isIdle)

/**
 * Single surface for the whole job lifecycle: queued → running →
 * completed/failed. Replaces the transient queue notification banners, reusing
 * their completion/failure signal.
 */
const { currentNotification } = useQueueNotificationBanners()

type ToastView = {
  status: 'progress' | 'done' | 'failed'
  verb: string
  percent: number | null
  showPercentText: boolean
  showStop: boolean
  /** First output thumbnail, shown on the completed chip. */
  thumbnailUrl?: string | null
  /** Completed with an output that has no preview image (video, audio). */
  showThumbnailPlaceholder?: boolean
}

/**
 * Which running job the pill and canvas track. The decided model: the canvas
 * shows the last-clicked run; from the panel the user can switch to another and
 * the pill follows. Null falls back to the most recent running job.
 */
const focusedJobId = ref<string | null>(null)

const initializingCount = computed(
  () => activeJobs.value.filter((job) => job.state === 'initialization').length
)

// Mirrors JobState: initialization and pending are distinct waits, and each
// state reuses the shared label the rest of the queue UI already shows.
const liveToastView = computed<ToastView | null>(() => {
  if (runningCount.value > 0 || isExecuting.value) {
    // The pill tracks one job — the focused (last-clicked) run. Parallelism
    // lives in the panel, not in a competing counter on the pill.
    const job = focusedJob.value
    return {
      status: 'progress',
      verb: t('g.running'),
      percent: job ? jobPercent(job) : totalPercent.value,
      showPercentText: true,
      showStop: true
    }
  }
  if (initializingCount.value > 0) {
    return {
      status: 'progress',
      // The queue panel's "Initializing - Almost ready" is too long for a pill
      // that must hold one width across every state.
      verb: t('queueStatus.starting'),
      percent: null,
      showPercentText: false,
      showStop: false
    }
  }
  if (pendingCount.value > 0) {
    return {
      status: 'progress',
      verb:
        pendingCount.value > 1
          ? t('queueStatus.queuedCount', { count: pendingCount.value })
          : t('g.queued'),
      percent: null,
      showPercentText: false,
      // Only a job that is actually executing can be stopped.
      showStop: false
    }
  }
  const notification = currentNotification.value
  if (notification?.type === 'completed') {
    const thumbnailUrl = notification.thumbnailUrls?.[0] ?? null
    return {
      status: 'done',
      verb: t('g.completed'),
      percent: null,
      showPercentText: false,
      showStop: false,
      thumbnailUrl,
      // No preview means the run produced non-image output; still show a tile.
      showThumbnailPlaceholder: !thumbnailUrl
    }
  }
  if (notification?.type === 'failed') {
    return {
      status: 'failed',
      verb: t('g.failed'),
      percent: null,
      showPercentText: false,
      showStop: false
    }
  }
  return null
})

/**
 * Dev-only harness: with ?toastDemo=1 in the URL, a scripted state overrides
 * the live one so every pill state can be reviewed in the real app — the
 * staging backend rarely reaches them — with the actual actions still wired.
 */
const isDemo =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('toastDemo')

type DemoState = {
  name: string
  view: ToastView | null
  running?: JobListItem[]
  queued?: JobListItem[]
}

const DEMO_THUMB =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b8ce9"/><stop offset="1" stop-color="#b33a3a"/></linearGradient></defs><rect width="48" height="48" fill="url(#g)"/></svg>'
  )
const demoJob = (
  id: string,
  title: string,
  state: JobListItem['state'],
  progressTotalPercent?: number
): JobListItem =>
  ({ id, title, meta: '', state, progressTotalPercent }) as JobListItem
const RUNNING_VIEW: ToastView = {
  status: 'progress',
  verb: t('g.running'),
  percent: 45,
  showPercentText: true,
  showStop: true
}
const demoStates: DemoState[] = [
  { name: 'Idle', view: null },
  {
    name: 'Queued',
    view: {
      status: 'progress',
      verb: t('queueStatus.queuedCount', { count: 3 }),
      percent: null,
      showPercentText: false,
      showStop: false
    }
  },
  {
    name: 'Starting',
    view: {
      status: 'progress',
      verb: t('queueStatus.starting'),
      percent: null,
      showPercentText: false,
      showStop: false
    }
  },
  {
    name: 'Running',
    view: RUNNING_VIEW,
    running: [demoJob('d-run-1', "Add Product to Character's Hand", 'running', 45)]
  },
  {
    name: 'Parallel + queue',
    view: RUNNING_VIEW,
    running: [
      demoJob('d-run-1', "Add Product to Character's Hand", 'running', 45),
      demoJob('d-run-2', 'Upscale to 4K', 'running', 68),
      demoJob('d-run-3', 'Relight product shot', 'running', 24)
    ],
    queued: [
      demoJob('d-q-1', 'Background swap', 'pending'),
      demoJob('d-q-2', 'Add reflections', 'pending'),
      demoJob('d-q-3', 'Export sheet', 'pending')
    ]
  },
  {
    name: 'Completed',
    view: {
      status: 'done',
      verb: t('g.completed'),
      percent: null,
      showPercentText: false,
      showStop: false,
      thumbnailUrl: DEMO_THUMB
    }
  },
  {
    name: 'Failed',
    view: {
      status: 'failed',
      verb: t('g.failed'),
      percent: null,
      showPercentText: false,
      showStop: false
    }
  }
]
const demoSelected = ref<DemoState>(demoStates[0])
const toastView = computed<ToastView | null>(() =>
  isDemo ? demoSelected.value.view : liveToastView.value
)

const ACTIVE_STATES: ReadonlySet<JobListItem['state']> = new Set([
  'running',
  'initialization',
  'pending',
  'failed'
])
/**
 * jobItems is newest-first; the panel reads as a timeline, so the most recent
 * run belongs at the bottom, next to the pill it came from.
 */
const activeJobs = computed(() =>
  jobItems.value.filter((job) => ACTIVE_STATES.has(job.state)).reverse()
)

/**
 * Running and queued are two different things and get two treatments, never
 * mixed: the panel shows what is running on top, what waits below. Running is
 * oldest-first so the newest — the last clicked — sits at the bottom, nearest
 * the pill.
 */
const runningJobs = computed(() =>
  isDemo
    ? (demoSelected.value.running ?? [])
    : activeJobs.value.filter((job) => isRunning(job))
)
const queuedJobs = computed(() =>
  isDemo
    ? (demoSelected.value.queued ?? [])
    : activeJobs.value.filter((job) => job.state === 'pending')
)

/** Focused job drives the pill; defaults to the most recent running job. */
const focusedJob = computed<JobListItem | null>(() => {
  const running = runningJobs.value
  if (!running.length) return null
  return (
    running.find((job) => job.id === focusedJobId.value) ??
    running[running.length - 1]
  )
})
const focusJob = (job: JobListItem) => {
  focusedJobId.value = job.id
}

const failedCount = computed(
  () => activeJobs.value.filter((job) => job.state === 'failed').length
)

/** Idle label, e.g. "0 active". */
const activeJobsLabel = computed(() => {
  const count = queueStore.activeJobsCount
  return t(
    'sideToolbar.queueProgressOverlay.activeJobsShort',
    { count: n(count) },
    count
  )
})
const isRunning = (job: JobListItem) =>
  job.state === 'running' || job.state === 'initialization'
const jobPercent = (job: JobListItem) =>
  Math.round(job.progressTotalPercent ?? 0)
/** buildJobDisplay already derives per-state copy; don't re-invent it here. */
const jobSubtitle = (job: JobListItem) => job.meta

/**
 * With one run there is no ambiguity, so stop interrupts it. With several,
 * stopping "the run" would silently take them all down; open the panel instead
 * and let the choice be explicit.
 */
const hasParallelRuns = computed(() => runningCount.value > 1)

/**
 * The trailing action shows for a failure (resolve) or a stoppable run, but
 * hides once the panel is open on parallel runs, where each row carries its own.
 */
const hidePillAction = computed(() => {
  const view = toastView.value
  if (!view) return true
  if (view.status === 'failed') return false
  if (!view.showStop) return true
  return hasParallelRuns.value && expanded.value
})

const onStopClick = () => {
  if (hasParallelRuns.value) {
    expanded.value = true
    return
  }
  void stopRunning()
}
const stopTooltip = computed(() =>
  buildTooltipConfig(
    hasParallelRuns.value
      ? t('queueStatus.chooseRunToStop')
      : t('sideToolbar.queueProgressOverlay.interruptAll')
  )
)
// No pause endpoint exists yet, so the control is present but inert.
const pauseTooltip = computed(() =>
  buildTooltipConfig(t('queueStatus.pauseUnavailable'))
)
const cancelTooltip = computed(() => buildTooltipConfig(t('queueStatus.cancel')))
const onCanvasTooltip = computed(() =>
  buildTooltipConfig(t('queueStatus.onCanvas'))
)
const viewHistoryTooltip = computed(() =>
  buildTooltipConfig(t('queueStatus.goToHistory'))
)

const { galleryActiveIndex, galleryItems } = useResultGallery(() =>
  activeJobs.value
    .map((job) => job.taskRef)
    .filter((task): task is TaskItemImpl => !!task)
)

/**
 * Latest finished jobs, newest first. Surfaced on the idle popover because that
 * is the moment people go looking for what a run produced — user tests showed
 * they don't know the outputs land in the assets panel. Each row keeps the
 * job's name and finish time, not just a bare thumbnail.
 */
const RECENT_JOB_LIMIT = 4
const recentJobs = computed(() =>
  jobItems.value
    .filter((job) => job.state === 'completed')
    .slice(0, RECENT_JOB_LIMIT)
)

const jobThumbnail = (job: JobListItem): ResultItemImpl | undefined =>
  job.taskRef?.previewOutput

/** Prefer the output's name; fall back to the finish status when there is none. */
const recentJobName = (job: JobListItem): string =>
  jobThumbnail(job)?.filename || job.title
/** Avoid repeating the name: show finish status, or the precise time as backup. */
const recentJobMeta = (job: JobListItem): string =>
  jobThumbnail(job)?.filename ? job.title : job.meta

const openRecentJob = (job: JobListItem) => {
  const outputs = recentJobs.value
    .map((entry) => jobThumbnail(entry))
    .filter((output): output is ResultItemImpl => !!output)
  const index = outputs.findIndex(
    (output) => output.url === jobThumbnail(job)?.url
  )
  if (index < 0) return
  galleryItems.value = outputs
  galleryActiveIndex.value = index
}

/**
 * Cancelling leaves activeJobId pointing at a job the backend will never
 * report on, so the pill would keep claiming a run in progress. Reconcile it
 * against what the queue actually holds, the way a reconnect does.
 */
const reconcileActiveJob = () => {
  executionStore.clearActiveJobIfStale(
    new Set([
      ...queueStore.runningTasks.map((task) => task.jobId),
      ...queueStore.pendingTasks.map((task) => task.jobId)
    ])
  )
}

const cancelJob = wrapWithErrorHandlingAsync(async (job: JobListItem) => {
  const jobId = job.taskRef?.jobId
  if (!jobId) return
  await api.cancelJob(String(jobId))
  executionStore.clearInitializationByJobId(String(jobId))
  await queueStore.update()
  reconcileActiveJob()
})

const toJobIds = (tasks: TaskItemImpl[]) =>
  tasks
    .map((task) => task.jobId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

const cancelJobIds = wrapWithErrorHandlingAsync(async (jobIds: string[]) => {
  if (!jobIds.length) return

  // State-agnostic batch cancel (see api.ts cancelJobs for the runtime-parity caveat).
  await api.cancelJobs(jobIds)
  executionStore.clearInitializationByJobIds(jobIds)
  await queueStore.update()
  reconcileActiveJob()
})

/**
 * The pill's stop interrupts what is executing and leaves the queue alone, so
 * whatever is next still starts. Clearing the queue is the panel's "Cancel all".
 */
const stopRunning = () => cancelJobIds(toJobIds(queueStore.runningTasks))
const cancelAll = () =>
  cancelJobIds(
    toJobIds([...queueStore.runningTasks, ...queueStore.pendingTasks])
  )
</script>
