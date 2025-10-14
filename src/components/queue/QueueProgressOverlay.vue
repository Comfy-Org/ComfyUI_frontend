<template>
  <div
    v-show="isVisible"
    :class="['flex', 'justify-end', 'w-full', 'pointer-events-none']"
  >
    <div
      class="pointer-events-auto rounded-lg border transition-colors duration-200 ease-in-out"
      :class="containerClass"
      :style="overlayStyle"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <!-- Expanded state -->
      <div
        v-if="isExpanded"
        class="flex w-full flex-col gap-[var(--spacing-spacing-xs)] p-[var(--spacing-spacing-xs)]"
      >
        <div
          class="flex items-center justify-between gap-[var(--spacing-spacing-xs)]"
        >
          <div class="text-[12px] font-bold text-white">{{ headerTitle }}</div>
          <div class="flex items-center gap-[var(--spacing-spacing-xss)]">
            <!-- Placeholder: Overflow menu button; no actions wired yet. -->
            <button
              class="inline-flex size-6 items-center justify-center rounded border-0 p-0 hover:opacity-90"
              :aria-label="
                st(
                  'sideToolbar.queueProgressOverlay.moreOptions',
                  'More options'
                )
              "
            >
              <i
                class="icon-[lucide--more-horizontal] block size-4 leading-none text-white"
              />
            </button>
            <button
              class="inline-flex size-6 items-center justify-center rounded border-0 p-0 hover:opacity-90"
              :aria-label="
                st('sideToolbar.queueProgressOverlay.close', 'Close')
              "
              @click="closeExpanded"
            >
              <i
                class="icon-[lucide--x] block size-4 leading-none text-white"
              />
            </button>
          </div>
        </div>
        <div class="h-px w-full bg-[var(--color-charcoal-400)]" />

        <div
          class="flex items-center justify-between gap-[var(--spacing-spacing-xs)]"
        >
          <button
            class="rounded border-0 bg-[var(--color-charcoal-500)] px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-xss)] text-[12px] text-white hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
            :aria-label="
              st('sideToolbar.queueProgressOverlay.showAssets', 'Show assets')
            "
            @click="openAssetsPanel"
          >
            {{ st('assets', 'Assets') }}
          </button>
          <div class="text-[12px] text-white opacity-90">
            <span class="font-bold">{{ queuedCount }}</span>
            <span class="ml-1">{{
              st(
                'sideToolbar.queueProgressOverlay.queuedWorkflowsSuffix',
                'queued workflows'
              )
            }}</span>
          </div>
          <button
            class="rounded border-0 bg-[var(--color-charcoal-500)] px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-xss)] text-[12px] text-white hover:bg-[var(--color-charcoal-600)] hover:opacity-90 disabled:opacity-50"
            :disabled="queuedCount === 0"
            :aria-label="
              st(
                'sideToolbar.queueProgressOverlay.cancelQueued',
                'Cancel queued workflows'
              )
            "
            @click="cancelQueuedWorkflows"
          >
            {{
              st(
                'sideToolbar.queueProgressOverlay.cancelQueued',
                'Cancel queued'
              )
            }}
          </button>
        </div>

        <div
          class="flex items-center justify-between gap-[var(--spacing-spacing-xs)]"
        >
          <div class="flex items-center gap-[var(--spacing-spacing-xss)]">
            <button
              v-for="tab in jobTabs"
              :key="tab"
              class="rounded border-0 px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-xss)] text-[12px] hover:opacity-90"
              :class="[
                selectedJobTab === tab
                  ? 'bg-[var(--color-charcoal-500)] text-white'
                  : 'text-[var(--color-slate-100)]'
              ]"
              @click="selectedJobTab = tab"
            >
              {{ tab }}
            </button>
          </div>
          <div class="flex items-center gap-[var(--spacing-spacing-xss)]">
            <button
              class="inline-flex size-6 items-center justify-center rounded border-0 p-0 hover:opacity-90"
              :aria-label="
                st('sideToolbar.queueProgressOverlay.filterJobs', 'Filter jobs')
              "
            >
              <i
                class="icon-[lucide--filter] block size-4 leading-none text-white"
              />
            </button>
            <button
              class="inline-flex size-6 items-center justify-center rounded border-0 p-0 hover:opacity-90"
              :aria-label="
                st('sideToolbar.queueProgressOverlay.sortJobs', 'Sort jobs')
              "
            >
              <i
                class="icon-[lucide--arrow-up-down] block size-4 leading-none text-white"
              />
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-[var(--spacing-spacing-xs)]">
          <div
            v-for="item in stubJobItems"
            :key="item.id"
            class="flex items-center justify-between gap-[var(--spacing-spacing-xs)] rounded border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-xs)] text-[12px] text-white"
          >
            <div
              class="flex min-w-0 flex-1 items-center gap-[var(--spacing-spacing-xs)]"
            >
              <div class="h-8 w-8 rounded bg-[var(--color-charcoal-500)]" />
              <div class="truncate opacity-90">{{ item.title }}</div>
            </div>
            <div class="flex items-center gap-[var(--spacing-spacing-xs)]">
              <span class="text-[var(--color-slate-100)]">{{ item.meta }}</span>
              <button
                class="inline-flex size-6 items-center justify-center rounded border-0 p-0 hover:opacity-90"
                :aria-label="st('g.more', 'More')"
              >
                <i
                  class="icon-[lucide--more-horizontal] block size-4 leading-none text-white"
                />
              </button>
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
              <span>{{ t('sideToolbar.queueProgressOverlay.total') }}</span>
              <span class="font-bold">{{ totalPercent }}</span>
              <span>%</span>
            </div>
            <div
              class="flex items-center gap-[var(--spacing-spacing-xss)] text-[var(--color-slate-100)]"
            >
              <span>{{
                t('sideToolbar.queueProgressOverlay.currentNode')
              }}</span>
              <span class="max-w-[10rem] truncate">{{ currentNodeName }}</span>
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
            st(
              'sideToolbar.queueProgressOverlay.expandCollapsedQueue',
              'Expand job queue'
            )
          "
          @click="openExpandedFromEmpty"
        >
          <span class="text-[14px] leading-none font-normal text-white">
            {{
              st(
                'sideToolbar.queueProgressOverlay.noActiveJobs',
                'No active jobs'
              )
            }}
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { st } from '@/i18n'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

const props = withDefaults(
  defineProps<{
    minWidth?: number
  }>(),
  {
    minWidth: 240
  }
)
const { t } = useI18n()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()
const sidebarTabStore = useSidebarTabStore()

const overlayWidth = computed(() => Math.max(0, Math.round(props.minWidth)))
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
const overlayStyle = computed(() => {
  const width = `${overlayWidth.value}px`
  return {
    minWidth: width,
    width
  }
})
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

const isVisible = computed(
  () => overlayWidth.value > 0 && !isFullyInvisible.value
)

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)))

const totalPercent = computed(() =>
  forceActiveStub.value
    ? 30
    : clampPercent((executionStore.executionProgress ?? 0) * 100)
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
  if (forceActiveStub.value) return 'CLIP Text Encode:'
  const node = executionStore.executingNode
  if (!node) return '—'
  const title = (node.title ?? '').toString().trim()
  if (title) return title
  const nodeType = (node.type ?? '').toString().trim() || 'Untitled'
  const key = `nodeDefs.${normalizeI18nKey(nodeType)}.display_name`
  return st(key, nodeType)
})

const headerTitle = computed(() =>
  hasActiveJob.value
    ? `${activeJobsCount.value} ${st(
        'sideToolbar.queueProgressOverlay.activeJobsSuffix',
        'active jobs'
      )}`
    : st('sideToolbar.queueProgressOverlay.jobQueue', 'Job Queue')
)

/** Tabs for job list filtering */
const jobTabs = ['All', 'Completed', 'Failed'] as const
const selectedJobTab = ref<(typeof jobTabs)[number]>('All')

/** Stubbed job list items for structure only */
const stubJobItems = computed(() => {
  const base = [
    { id: '1', title: 'Workflow A — Placeholder', meta: '00:12 • 1 output' },
    { id: '2', title: 'Workflow B — Placeholder', meta: '01:03 • 3 outputs' },
    { id: '3', title: 'Workflow C — Placeholder', meta: '00:45 • 2 outputs' }
  ]
  if (selectedJobTab.value === 'Completed') return base.slice(0, 2)
  if (selectedJobTab.value === 'Failed') return base.slice(2)
  return base
})

const openExpandedFromEmpty = () => {
  isExpanded.value = true
}

const closeExpanded = () => {
  isExpanded.value = false
}

const viewAllJobs = async () => {
  isExpanded.value = true
}

/** Opens the Assets (Model Library) sidebar */
const openAssetsPanel = () => {
  sidebarTabStore.activeSidebarTabId = 'model-library'
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
</script>
