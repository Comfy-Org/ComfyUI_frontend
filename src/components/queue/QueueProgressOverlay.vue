<template>
  <div
    v-show="isVisible"
    :class="['flex', 'justify-end', 'w-full', 'pointer-events-none']"
  >
    <div
      class="pointer-events-auto w-[310px] min-w-[310px] rounded-lg border transition-colors duration-200 ease-in-out"
      :class="containerClass"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <!-- Expanded state -->
      <div
        v-if="isExpanded"
        class="flex w-full flex-col gap-[var(--spacing-spacing-md)]"
      >
        <div
          class="flex h-12 items-center justify-between gap-[var(--spacing-spacing-xs)] border-b border-[var(--color-charcoal-400)] px-[var(--spacing-spacing-xs)]"
        >
          <div
            class="px-[var(--spacing-spacing-xs)] text-[14px] font-normal text-white"
          >
            <span>{{ headerTitle }}</span>
            <span
              v-if="showConcurrentIndicator"
              class="ml-[var(--spacing-spacing-md)] inline-flex items-center gap-[var(--spacing-spacing-xss)] text-blue-100"
            >
              <span class="inline-block size-2 rounded-full bg-blue-100" />
              <span>
                <span class="font-bold">{{ concurrentWorkflowCount }}</span>
                <span class="ml-[var(--spacing-spacing-xss)]">{{
                  t('sideToolbar.queueProgressOverlay.running')
                }}</span>
              </span>
            </span>
          </div>
          <div class="flex items-center gap-[var(--spacing-spacing-xss)]">
            <button
              v-tooltip.top="moreTooltipConfig"
              class="inline-flex size-6 items-center justify-center rounded border-0 bg-transparent p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-100"
              :aria-label="t('sideToolbar.queueProgressOverlay.moreOptions')"
              @click="onMoreClick"
            >
              <i
                class="icon-[lucide--more-horizontal] block size-4 leading-none text-[var(--color-text-secondary)]"
              />
            </button>
            <Popover
              ref="morePopoverRef"
              :dismissable="true"
              :close-on-escape="true"
              unstyled
              :pt="{
                root: { class: 'absolute z-50' },
                content: {
                  class: [
                    'bg-transparent border-none p-0 pt-2 rounded-lg shadow-lg'
                  ]
                }
              }"
              @hide="isMoreOpen = false"
            >
              <div
                class="flex flex-col items-stretch rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-sm)]"
              >
                <button
                  class="inline-flex w-full items-center justify-start gap-[var(--spacing-spacing-xss)] rounded-[var(--corner-radius-corner-radius-md)] border-0 bg-transparent p-[var(--spacing-spacing-xs)] text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
                  :aria-label="
                    t('sideToolbar.queueProgressOverlay.showAssetsPanel')
                  "
                  @click="onShowAssetsFromMenu"
                >
                  <i-comfy:image-ai-edit
                    class="block size-4 shrink-0 leading-none"
                    aria-hidden="true"
                  />
                  <span>{{
                    t('sideToolbar.queueProgressOverlay.showAssetsPanel')
                  }}</span>
                </button>
                <div
                  class="mx-[var(--spacing-spacing-xs)] my-[var(--spacing-spacing-xxs)] h-px bg-[var(--color-charcoal-400)]"
                />
                <button
                  class="inline-flex w-full items-center justify-start gap-[var(--spacing-spacing-xss)] rounded-[var(--corner-radius-corner-radius-md)] border-0 bg-transparent p-[var(--spacing-spacing-xs)] text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
                  :aria-label="
                    t('sideToolbar.queueProgressOverlay.clearHistory')
                  "
                  @click="onClearHistoryFromMenu"
                >
                  <i
                    class="icon-[lucide--history] block size-4 leading-none text-white"
                  />
                  <span>{{
                    t('sideToolbar.queueProgressOverlay.clearHistory')
                  }}</span>
                </button>
                <div
                  class="mx-[var(--spacing-spacing-xs)] mt-[var(--spacing-spacing-xxs)] h-px bg-[var(--color-charcoal-400)]"
                />
              </div>
            </Popover>
            <button
              class="inline-flex size-6 items-center justify-center rounded border-0 bg-transparent p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-100"
              :aria-label="t('g.close')"
              @click="closeExpanded"
            >
              <i
                class="icon-[lucide--x] block size-4 leading-none text-[var(--color-text-secondary)]"
              />
            </button>
          </div>
        </div>

        <div class="flex w-full flex-col gap-[var(--spacing-spacing-md)]">
          <div
            class="flex items-center justify-between px-[var(--spacing-spacing-sm)]"
          >
            <button
              class="inline-flex h-8 flex-1 items-center justify-center gap-[var(--spacing-spacing-xxs)] rounded-[var(--corner-radius-corner-radius-md)] border-0 bg-[var(--color-charcoal-500)] px-[var(--spacing-spacing-xs)] py-0 text-[12px] leading-none text-white hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
              :aria-label="t('sideToolbar.queueProgressOverlay.showAssets')"
              @click="openQueueSidebar"
            >
              <i-comfy:image-ai-edit
                class="pointer-events-none block size-4 shrink-0 leading-none"
                aria-hidden="true"
              />
              <span>{{
                t('sideToolbar.queueProgressOverlay.showAssets')
              }}</span>
            </button>

            <div
              class="ml-[var(--spacing-spacing-md)] inline-flex items-center"
            >
              <div
                class="inline-flex h-6 items-center text-[12px] leading-none text-white opacity-90"
              >
                <span class="font-bold">{{ queuedCount }}</span>
                <span class="ml-[var(--spacing-spacing-xss)]">{{
                  t('sideToolbar.queueProgressOverlay.queuedSuffix')
                }}</span>
              </div>
              <button
                v-if="queuedCount > 0"
                class="ml-[var(--spacing-spacing-xs)] inline-flex size-6 items-center justify-center rounded border-0 bg-[var(--color-charcoal-500)] p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
                :aria-label="t('sideToolbar.queueProgressOverlay.clearQueued')"
                @click="cancelQueuedWorkflows"
              >
                <i
                  class="pointer-events-none icon-[lucide--list-x] block size-4 leading-none text-white"
                />
              </button>
            </div>
          </div>

          <div
            class="flex items-center justify-between gap-[var(--spacing-spacing-xs)] px-[var(--spacing-spacing-sm)]"
          >
            <div class="min-w-0 flex-1 overflow-x-auto">
              <div
                class="inline-flex items-center gap-[var(--spacing-spacing-xss)] whitespace-nowrap"
              >
                <button
                  v-for="tab in jobTabs"
                  :key="tab"
                  class="h-6 rounded border-0 px-[var(--spacing-spacing-sm)] py-[var(--spacing-spacing-xss)] text-[12px] leading-none hover:opacity-90"
                  :class="[
                    selectedJobTab === tab
                      ? 'bg-[var(--color-charcoal-500)] text-white'
                      : 'bg-transparent text-[var(--color-slate-100)]'
                  ]"
                  @click="selectedJobTab = tab"
                >
                  {{ tabLabel(tab) }}
                </button>
              </div>
            </div>
            <div
              class="ml-[var(--spacing-spacing-xs)] flex shrink-0 items-center gap-[var(--spacing-spacing-xs)]"
            >
              <button
                v-tooltip.top="filterTooltipConfig"
                class="inline-flex size-6 items-center justify-center rounded border-0 bg-[var(--color-charcoal-500)] p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
                :aria-label="t('sideToolbar.queueProgressOverlay.filterJobs')"
              >
                <i
                  class="icon-[lucide--list-filter] block size-4 leading-none text-white"
                />
              </button>
              <button
                v-tooltip.top="sortTooltipConfig"
                class="inline-flex size-6 items-center justify-center rounded border-0 bg-[var(--color-charcoal-500)] p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
                :aria-label="t('sideToolbar.queueProgressOverlay.sortJobs')"
              >
                <i
                  class="icon-[lucide--arrow-up-down] block size-4 leading-none text-white"
                />
              </button>
            </div>
          </div>

          <div
            class="flex flex-col gap-[var(--spacing-spacing-md)] px-[var(--spacing-spacing-sm)] pb-[var(--spacing-spacing-md)]"
          >
            <div
              v-for="group in groupedJobItems"
              :key="group.key"
              class="flex flex-col gap-[var(--spacing-spacing-xs)]"
            >
              <div
                class="text-[12px] leading-none text-[var(--color-slate-100)]"
              >
                {{ group.label }}
              </div>
              <QueueJobItem
                v-for="ji in group.items"
                :key="ji.id"
                :state="ji.state"
                :title="ji.title"
                :right-text="ji.meta"
                :icon-name="ji.iconName"
                :icon-image-url="ji.iconImageUrl"
                :show-clear="ji.showClear"
                :show-menu="true"
                :progress-total-percent="ji.progressTotalPercent"
                :progress-current-percent="ji.progressCurrentPercent"
                :running-node-name="ji.runningNodeName"
                @clear="onClearItem(ji)"
                @menu="onMenuItem(ji)"
                @view="onViewItem(ji)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Passive/Active state -->
      <div
        v-else-if="hasActiveJob"
        class="flex flex-col gap-[var(--spacing-spacing-sm)] p-[var(--spacing-spacing-xs)]"
      >
        <div class="flex flex-col gap-[var(--spacing-spacing-xss)]">
          <div
            class="relative h-2 w-full overflow-hidden rounded-full border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)]"
          >
            <div
              class="absolute inset-0 h-full rounded-full transition-[width]"
              :style="totalProgressStyle"
            />
            <div
              class="absolute inset-0 h-full rounded-full transition-[width]"
              :style="currentNodeProgressStyle"
            />
          </div>
          <div
            class="flex items-start justify-end gap-[var(--spacing-spacing-md)] text-[12px] leading-none"
          >
            <div
              class="flex items-center gap-[var(--spacing-spacing-xss)] text-white opacity-90"
            >
              <i18n-t keypath="sideToolbar.queueProgressOverlay.total">
                <template #percent>
                  <span class="font-bold">{{ totalPercentFormatted }}</span>
                </template>
              </i18n-t>
            </div>
            <div
              class="flex items-center gap-[var(--spacing-spacing-xss)] text-[var(--color-slate-100)]"
            >
              <span>{{
                t('sideToolbar.queueProgressOverlay.currentNode')
              }}</span>
              <span class="inline-block max-w-[10rem] truncate">{{
                currentNodeName
              }}</span>
              <span class="flex items-center gap-[var(--spacing-spacing-xss)]">
                <span>{{ currentNodePercent }}</span>
                <span>%</span>
              </span>
            </div>
          </div>
        </div>

        <div :class="bottomRowClass">
          <div
            class="flex items-center gap-[var(--spacing-spacing-xs)] text-[12px] text-white"
          >
            <span class="opacity-90">
              <span class="font-bold">{{ runningCount }}</span>
              <span class="ml-[var(--spacing-spacing-xss)]">{{
                t('sideToolbar.queueProgressOverlay.running')
              }}</span>
            </span>
            <button
              v-if="runningCount > 0"
              class="inline-flex size-6 items-center justify-center rounded border-0 bg-[var(--color-charcoal-500)] p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
              :aria-label="t('sideToolbar.queueProgressOverlay.interruptAll')"
              @click="interruptAll"
            >
              <i
                class="icon-[lucide--x] block size-4 leading-none text-white"
              />
            </button>
          </div>

          <button
            class="w-full rounded border-0 bg-[var(--color-charcoal-500)] px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-xss)] text-[12px] text-white hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
            @click="viewAllJobs"
          >
            {{ t('sideToolbar.queueProgressOverlay.viewAllJobs') }}
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="pointer-events-auto">
        <button
          type="button"
          class="group flex h-10 w-full items-center justify-between gap-[calc(var(--spacing-spacing-xs)+var(--spacing-spacing-xss))] rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] py-[var(--spacing-spacing-xss)] pr-[var(--spacing-spacing-xs)] pl-[calc(var(--spacing-spacing-xs)*2)] text-left transition-colors duration-200 ease-in-out hover:cursor-pointer hover:border-[var(--color-charcoal-300)] hover:bg-[var(--color-charcoal-700)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-slate-200)]"
          :aria-label="
            t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')
          "
          @click="openExpandedFromEmpty"
        >
          <span class="text-[14px] leading-none font-normal text-white">
            {{ t('sideToolbar.queueProgressOverlay.noActiveJobs') }}
          </span>
          <span
            class="flex items-center justify-center rounded p-[var(--spacing-spacing-xss)] text-[var(--color-slate-100)] transition-colors duration-200 ease-in-out group-hover:bg-[var(--color-charcoal-600)] group-hover:text-white"
          >
            <i class="icon-[lucide--chevron-down] block size-4 leading-none" />
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import QueueJobItem from '@/components/queue/QueueJobItem.vue'
import { st } from '@/i18n'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

const { t, locale } = useI18n()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()
const sidebarTabStore = useSidebarTabStore()

/** Temporary: toggle stub active progress with '+' key for testing */
const forceActiveStub = ref(false)
const toggleForceActiveStub = () => {
  forceActiveStub.value = !forceActiveStub.value
}
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === '+' || (event.key === '=' && event.shiftKey)) {
    toggleForceActiveStub()
  }
}
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
const isHovered = ref(false)
const isExpanded = ref(false)
const isMoreOpen = ref(false)
const containerClass = computed(() =>
  showBackground.value
    ? 'border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] shadow-md'
    : 'border-transparent bg-transparent shadow-none'
)
const bottomRowClass = computed(
  () =>
    `flex items-center justify-end gap-[var(--spacing-spacing-md)] transition-opacity duration-200 ease-in-out ${
      isActiveState.value
        ? 'opacity-100 pointer-events-auto'
        : 'opacity-0 pointer-events-none'
    }`
)

const runningCount = computed(() =>
  forceActiveStub.value ? 1 : queueStore.runningTasks.length
)
const queuedCount = computed(() => queueStore.pendingTasks.length)
const hasHistory = computed(() => queueStore.historyTasks.length > 0)
const isExecuting = computed(
  () => forceActiveStub.value || !executionStore.isIdle
)
const hasActiveJob = computed(() => runningCount.value > 0 || isExecuting.value)
const activeJobsCount = computed(
  () => runningCount.value + queueStore.pendingTasks.length
)

const isFullyInvisible = computed(
  () => !hasActiveJob.value && !hasHistory.value
)
const isEmptyState = computed(() => !hasActiveJob.value && hasHistory.value)
const isActiveState = computed(() => hasActiveJob.value && isHovered.value)

const showBackground = computed(
  () => isExpanded.value || isActiveState.value || isEmptyState.value
)

const isVisible = computed(() => !isFullyInvisible.value)

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)))

const totalPercent = computed(() =>
  forceActiveStub.value
    ? 30
    : clampPercent((executionStore.executionProgress ?? 0) * 100)
)

const totalPercentFormatted = computed(() =>
  new Intl.NumberFormat(locale.value, {
    style: 'percent',
    maximumFractionDigits: 0
  }).format((totalPercent.value || 0) / 100)
)

const currentNodePercent = computed(() =>
  forceActiveStub.value
    ? 60
    : clampPercent((executionStore.executingNodeProgress ?? 0) * 100)
)

const totalProgressStyle = computed(() => ({
  width: `${totalPercent.value}%`,
  background: 'var(--color-interface-panel-job-progress-primary)'
}))

const currentNodeProgressStyle = computed(() => ({
  width: `${currentNodePercent.value}%`,
  background: 'var(--color-interface-panel-job-progress-secondary)'
}))

const currentNodeName = computed(() => {
  if (forceActiveStub.value)
    return t('sideToolbar.queueProgressOverlay.stubClipTextEncode')
  const node = executionStore.executingNode
  if (!node) return t('g.emDash')
  const title = (node.title ?? '').toString().trim()
  if (title) return title
  const nodeType = (node.type ?? '').toString().trim() || t('g.untitled')
  const key = `nodeDefs.${normalizeI18nKey(nodeType)}.display_name`
  return st(key, nodeType)
})

const headerTitle = computed(() =>
  hasActiveJob.value
    ? `${activeJobsCount.value} ${t('sideToolbar.queueProgressOverlay.activeJobsSuffix')}`
    : t('sideToolbar.queueProgressOverlay.jobQueue')
)

const concurrentWorkflowCount = computed(
  () => executionStore.runningWorkflowCount
)
const showConcurrentIndicator = computed(
  () => concurrentWorkflowCount.value > 1
)

/** Tabs for job list filtering */
const jobTabs = ['All', 'Completed', 'Failed'] as const
const tabLabel = (tab: (typeof jobTabs)[number]) => {
  if (tab === 'All') return t('g.all')
  if (tab === 'Completed') return t('g.completed')
  return t('g.failed')
}
const selectedJobTab = ref<(typeof jobTabs)[number]>('All')

type JobListItem = {
  id: string
  title: string
  meta: string
  state:
    | 'added'
    | 'queued'
    | 'initialization'
    | 'running'
    | 'completed'
    | 'failed'
  iconName?: string
  iconImageUrl?: string
  showClear?: boolean
  taskRef?: any
  progressTotalPercent?: number
  progressCurrentPercent?: number
  runningNodeName?: string
}

const formatTime = (time?: number) => {
  if (time === undefined) return ''
  return `${time.toFixed(2)}s`
}

const formatClockTime = (timestamp?: number) => {
  if (timestamp === undefined) return ''
  const d = new Date(timestamp)
  let h = d.getHours() % 12
  h = h === 0 ? 12 : h
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  const ampm = d.getHours() >= 12 ? 'pm' : 'am'
  return `${h}:${m}:${s}${ampm}`
}

const deriveStateFromTask = (task: any): JobListItem['state'] => {
  if (isJobInitializing(task?.promptId)) return 'initialization'
  if (task.taskType === 'Pending') return 'queued'
  if (task.taskType === 'Running') return 'running'
  if (task.taskType === 'History') {
    const status = task.displayStatus
    if (status === 'Completed') return 'completed'
    if (status === 'Failed') return 'failed'
    if (status === 'Cancelled') return 'failed'
  }
  return 'queued'
}

const formatTitleForTask = (task: any) => {
  const prefix = t('g.job')
  const shortId = String(task.promptId ?? '').split('-')[0]
  const idx = task.queueIndex ?? ''
  if (idx !== '') return `${prefix} #${idx}`
  if (shortId) return `${prefix} ${shortId}`
  return prefix
}

const formatMetaForTask = (task: any, state: JobListItem['state']) => {
  if (state === 'running') return t('g.running')
  if (state === 'queued' || state === 'initialization' || state === 'added') {
    const pid = String(task.promptId ?? '')
    const ts = queueStore.firstSeenByPromptId?.[pid]
    return formatClockTime(ts)
  }
  if (state === 'completed') {
    const time = formatTime(task.executionTimeInSeconds)
    return time || ''
  }
  if (state === 'failed') return t('g.failed')
  return ''
}

const allTasksSorted = computed(() => {
  const all = [
    ...queueStore.pendingTasks,
    ...queueStore.runningTasks,
    ...queueStore.historyTasks
  ]
  return all.sort((a, b) => b.queueIndex - a.queueIndex)
})

const filteredTasks = computed(() => {
  if (selectedJobTab.value === 'Completed') {
    return allTasksSorted.value.filter(
      (t) => deriveStateFromTask(t) === 'completed'
    )
  }
  if (selectedJobTab.value === 'Failed') {
    return allTasksSorted.value.filter((t) => {
      const s = deriveStateFromTask(t)
      return s === 'failed'
    })
  }
  return allTasksSorted.value
})

const jobItems = computed<JobListItem[]>(() =>
  filteredTasks.value.map((task: any) => {
    const state = deriveStateFromTask(task)

    let iconName: string | undefined
    let iconImageUrl: string | undefined

    if (state === 'completed') {
      const previewOutput = task.previewOutput
      if (previewOutput && previewOutput.isImage) {
        iconImageUrl = previewOutput.urlWithTimestamp
      } else {
        iconName = 'icon-[lucide--check]'
      }
    } else if (state === 'running') {
      iconName = 'icon-[lucide--zap]'
    } else if (state === 'queued') {
      iconName = 'icon-[lucide--clock]'
    } else if (state === 'failed') {
      iconName = 'icon-[lucide--alert-circle]'
    }

    const completedPreviewOutput =
      state === 'completed' ? task.previewOutput : undefined
    const displayTitle =
      state === 'completed' && completedPreviewOutput?.filename
        ? completedPreviewOutput.filename
        : formatTitleForTask(task)

    const isActive =
      String(task.promptId ?? '') ===
      String(executionStore.activePromptId ?? '')
    return {
      id: String(task.promptId),
      title: displayTitle,
      meta: formatMetaForTask(task, state),
      state,
      iconName,
      iconImageUrl,
      showClear: state === 'queued' || state === 'failed',
      taskRef: task,
      progressTotalPercent:
        state === 'running' && isActive ? totalPercent.value : undefined,
      progressCurrentPercent:
        state === 'running' && isActive ? currentNodePercent.value : undefined,
      runningNodeName:
        state === 'running' && isActive ? currentNodeName.value : undefined
    } as JobListItem
  })
)

type JobGroup = {
  key: string
  label: string
  items: JobListItem[]
}

/** Returns YYYY-MM-DD for local date. */
const dateKeyForTimestamp = (ts: number) => {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Returns Today, Yesterday, or Mon DD. */
const dateLabelForTimestamp = (ts: number) => {
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return 'Today'
  const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const isYest =
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate()
  if (isYest) return 'Yesterday'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(d)
}

const jobItemById = computed(() => {
  const m = new Map<string, JobListItem>()
  jobItems.value.forEach((ji) => m.set(ji.id, ji))
  return m
})

const groupedJobItems = computed<JobGroup[]>(() => {
  const groups: JobGroup[] = []
  const index = new Map<string, number>()
  for (const task of filteredTasks.value) {
    const state = deriveStateFromTask(task)
    const pid = String(task.promptId ?? '')
    let ts: number | undefined
    if (state === 'completed' || state === 'failed') {
      ts = task.executionEndTimestamp
    } else {
      ts = queueStore.firstSeenByPromptId?.[pid]
    }
    const effectiveTs = ts ?? Date.now()
    const key = dateKeyForTimestamp(effectiveTs)
    let groupIdx = index.get(key)
    if (groupIdx === undefined) {
      groups.push({ key, label: dateLabelForTimestamp(effectiveTs), items: [] })
      groupIdx = groups.length - 1
      index.set(key, groupIdx)
    }
    const ji = jobItemById.value.get(String(task.promptId))
    if (ji) groups[groupIdx].items.push(ji)
  }
  return groups
})

const onClearItem = async (item: JobListItem) => {
  if (!item.taskRef) return
  await queueStore.delete(item.taskRef)
}

const onMenuItem = (_item: JobListItem) => {
  // Placeholder for future context menu
}

const onViewItem = (_item: JobListItem) => {
  // Stub for view action
}

const openExpandedFromEmpty = () => {
  isExpanded.value = true
}

const closeExpanded = () => {
  isExpanded.value = false
}

const viewAllJobs = async () => {
  isExpanded.value = true
}

/** Opens the Queue sidebar */
const openQueueSidebar = () => {
  sidebarTabStore.activeSidebarTabId = 'queue'
}

/** Cancels all queued (pending) workflows */
const cancelQueuedWorkflows = async () => {
  const pending = [...queueStore.pendingTasks]
  for (const task of pending) {
    await api.deleteItem('queue', task.promptId)
  }
  await queueStore.update()
}

const interruptAll = async () => {
  const tasks = queueStore.runningTasks
  for (const task of tasks) {
    await api.interrupt(task.promptId)
  }
}
/** Determines if a job is currently in initialization */
const isJobInitializing = (promptId: string | number | undefined) =>
  executionStore.isPromptInitializing(promptId)

const morePopoverRef = ref<InstanceType<typeof Popover> | null>(null)
const moreTooltipConfig = computed(() => ({
  value: t('g.more'),
  showDelay: 300,
  hideDelay: 0,
  pt: {
    text: {
      class:
        'border bg-[var(--color-charcoal-800)] border-[var(--color-slate-300)] rounded-md px-2 py-1 text-xs leading-none shadow-none'
    },
    arrow: {
      class: 'border-t-[var(--color-slate-300)]'
    }
  }
}))
const filterTooltipConfig = computed(() => ({
  value: t('sideToolbar.queueProgressOverlay.filterBy'),
  showDelay: 300,
  hideDelay: 0,
  pt: {
    text: {
      class:
        'border bg-[var(--color-charcoal-800)] border-[var(--color-slate-300)] rounded-md px-2 py-1 text-xs leading-none shadow-none'
    },
    arrow: {
      class: 'border-t-[var(--color-slate-300)]'
    }
  }
}))
const sortTooltipConfig = computed(() => ({
  value: t('sideToolbar.queueProgressOverlay.sortBy'),
  showDelay: 300,
  hideDelay: 0,
  pt: {
    text: {
      class:
        'border bg-[var(--color-charcoal-800)] border-[var(--color-slate-300)] rounded-md px-2 py-1 text-xs leading-none shadow-none'
    },
    arrow: {
      class: 'border-t-[var(--color-slate-300)]'
    }
  }
}))
const onMoreClick = (event: Event) => {
  if (morePopoverRef.value) {
    morePopoverRef.value.toggle(event)
    isMoreOpen.value = !isMoreOpen.value
  }
}
const onShowAssetsFromMenu = () => {
  openQueueSidebar()
  morePopoverRef.value?.hide()
  isMoreOpen.value = false
}
const onClearHistoryFromMenu = async () => {
  await queueStore.clear(['history'])
  morePopoverRef.value?.hide()
  isMoreOpen.value = false
}
</script>
