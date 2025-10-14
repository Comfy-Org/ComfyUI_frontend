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
      <div v-if="isExpanded" class="flex w-full flex-col gap-2 p-2">
        <div class="flex items-center justify-between gap-2">
          <div class="text-[12px] font-bold text-white">{{ headerTitle }}</div>
          <div class="flex items-center gap-1">
            <!-- Placeholder: Overflow menu button; no actions wired yet. -->
            <button
              class="rounded p-1 hover:opacity-90"
              :aria-label="
                st(
                  'sideToolbar.queueProgressOverlay.moreOptions',
                  'More options'
                )
              "
            >
              <i class="pi pi-ellipsis-h text-xs text-white" />
            </button>
            <button
              class="rounded p-1 hover:opacity-90"
              :aria-label="
                st('sideToolbar.queueProgressOverlay.close', 'Close')
              "
              @click="closeExpanded"
            >
              <i class="pi pi-times text-xs text-white" />
            </button>
          </div>
        </div>
        <div class="h-px w-full bg-[var(--p-panel-border-color)]" />

        <!-- Row 1: assets button | queued workflows | cancel queued -->
        <div class="flex items-center justify-between gap-2">
          <button
            class="rounded bg-[#2d2e32] px-2 py-1 text-[12px] text-white hover:opacity-90"
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
            class="rounded bg-[#2d2e32] px-2 py-1 text-[12px] text-white hover:opacity-90 disabled:opacity-50"
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

        <!-- Row 2: tabs | filter | sort -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1">
            <button
              v-for="tab in jobTabs"
              :key="tab"
              class="rounded px-2 py-1 text-[12px] hover:opacity-90"
              :class="[
                selectedJobTab === tab
                  ? 'bg-[#2d2e32] text-white'
                  : 'text-[#9c9eab]'
              ]"
              @click="selectedJobTab = tab"
            >
              {{ tab }}
            </button>
          </div>
          <div class="flex items-center gap-1">
            <button
              class="rounded p-1 hover:opacity-90"
              :aria-label="
                st('sideToolbar.queueProgressOverlay.filterJobs', 'Filter jobs')
              "
            >
              <i class="pi pi-filter text-xs text-white" />
            </button>
            <button
              class="rounded p-1 hover:opacity-90"
              :aria-label="
                st('sideToolbar.queueProgressOverlay.sortJobs', 'Sort jobs')
              "
            >
              <i class="pi pi-sort-alt text-xs text-white" />
            </button>
          </div>
        </div>

        <!-- Row 3: job list (stubbed horizontal cards) -->
        <div class="flex flex-col gap-2">
          <div
            v-for="item in stubJobItems"
            :key="item.id"
            class="flex items-center justify-between gap-2 rounded border border-[var(--p-panel-border-color)] bg-[var(--comfy-menu-bg)] px-2 py-2 text-[12px] text-white"
          >
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <div class="h-8 w-8 rounded bg-[#2d2e32]" />
              <div class="truncate opacity-90">{{ item.title }}</div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[#9c9eab]">{{ item.meta }}</span>
              <button
                class="rounded p-1 hover:opacity-90"
                :aria-label="st('g.more', 'More')"
              >
                <i class="pi pi-ellipsis-h text-xs text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="hasActiveJob" class="flex flex-col gap-3 p-2">
        <div class="flex flex-col gap-1">
          <div
            class="relative h-2 w-full overflow-hidden rounded-full"
            :style="{
              background: 'var(--color-interface-panel-job-progress-track)'
            }"
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
            class="flex items-start justify-end gap-4 text-[12px] leading-none"
          >
            <div class="flex items-center gap-1 text-white opacity-90">
              <span>{{ t('sideToolbar.queueProgressOverlay.total') }}</span>
              <span class="font-bold">{{ totalPercent }}</span>
              <span>%</span>
            </div>
            <div class="flex items-center gap-1 text-[#9c9eab]">
              <span>{{
                t('sideToolbar.queueProgressOverlay.currentNode')
              }}</span>
              <span class="max-w-[10rem] truncate">{{ currentNodeName }}</span>
              <span class="flex items-center gap-1">
                <span>{{ currentNodePercent }}</span>
                <span>%</span>
              </span>
            </div>
          </div>
        </div>

        <div :class="bottomRowClass">
          <div class="flex items-center gap-2 text-[12px] text-white">
            <span class="opacity-90">
              <span class="font-bold">{{ runningCount }}</span>
              <span class="ml-1">{{
                t('sideToolbar.queueProgressOverlay.running')
              }}</span>
            </span>
            <button
              v-if="runningCount > 0"
              class="rounded bg-[#2d2e32] p-1 hover:opacity-90"
              :aria-label="t('sideToolbar.queueProgressOverlay.interruptAll')"
              @click="interruptAll"
            >
              <i class="pi pi-times text-xs text-white" />
            </button>
          </div>

          <button
            class="w-full rounded bg-[#2d2e32] px-2 py-1 text-[12px] text-white hover:opacity-90"
            @click="viewAllJobs"
          >
            {{ t('sideToolbar.queueProgressOverlay.viewAllJobs') }}
          </button>
        </div>
      </div>

      <div
        v-else
        class="flex cursor-pointer items-center justify-between gap-4 p-2"
        @click="openExpandedFromEmpty"
      >
        <div class="text-[12px] text-[#9c9eab]">
          {{
            st(
              'sideToolbar.queueProgressOverlay.noActiveJobs',
              'No active jobs'
            )
          }}
        </div>
        <i class="pi pi-chevron-down text-xs text-white opacity-90" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
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
    ? 'border-[var(--p-panel-border-color)] bg-[var(--comfy-menu-bg)] shadow-md'
    : 'border-transparent bg-transparent shadow-none'
)
const bottomRowClass = computed(
  () =>
    `flex items-center justify-end gap-4 transition-opacity duration-200 ease-in-out ${
      isActiveState.value
        ? 'opacity-100 pointer-events-auto'
        : 'opacity-0 pointer-events-none'
    }`
)

const runningCount = computed(() => queueStore.runningTasks.length)
const queuedCount = computed(() => queueStore.pendingTasks.length)
const hasHistory = computed(() => queueStore.historyTasks.length > 0)
const isExecuting = computed(() => !executionStore.isIdle)
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
  clampPercent((executionStore.executionProgress ?? 0) * 100)
)

const currentNodePercent = computed(() =>
  clampPercent((executionStore.executingNodeProgress ?? 0) * 100)
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
