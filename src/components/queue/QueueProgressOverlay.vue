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
      <div v-if="hasActiveJob" class="flex flex-col gap-3 p-2">
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

      <div v-else class="flex items-center justify-between gap-4 p-2">
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

const overlayWidth = computed(() => Math.max(0, Math.round(props.minWidth)))
const isHovered = ref(false)
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
const hasHistory = computed(() => queueStore.historyTasks.length > 0)
const isExecuting = computed(() => !executionStore.isIdle)
const hasActiveJob = computed(() => runningCount.value > 0 || isExecuting.value)

const isFullyInvisible = computed(
  () => !hasActiveJob.value && !hasHistory.value
)
const isEmptyState = computed(() => !hasActiveJob.value && hasHistory.value)
const isActiveState = computed(() => hasActiveJob.value && isHovered.value)

const showBackground = computed(() => isActiveState.value || isEmptyState.value)

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

const viewAllJobs = async () => {
  // Placeholder for future functionality
  return
}

const interruptAll = async () => {
  const tasks = queueStore.runningTasks
  for (const task of tasks) {
    await api.interrupt(task.promptId)
  }
}
</script>
