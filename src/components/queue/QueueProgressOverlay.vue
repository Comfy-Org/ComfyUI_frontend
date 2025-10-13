<template>
  <div
    v-show="isVisible"
    :class="['flex', 'justify-end', 'w-full', 'pointer-events-none']"
  >
    <div
      class="pointer-events-auto rounded-lg border border-[var(--p-panel-border-color)] bg-[var(--comfy-menu-bg)] shadow-md"
      :style="overlayStyle"
    >
      <div class="flex flex-col gap-3 p-2">
        <div class="flex flex-col gap-1">
          <div class="relative h-2 w-full rounded-lg bg-[var(--comfy-menu-bg)]">
            <div
              class="absolute top-0 left-0 h-full rounded-lg bg-[rgba(11,140,233,0.3)]"
              :style="{ width: totalPercent + '%' }"
            />
            <div
              class="absolute top-0 left-0 h-full rounded-lg bg-[#185a8b]"
              :style="{ width: currentNodePercent + '%' }"
            />
            <div
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 rounded-lg border border-[var(--p-panel-border-color)]"
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

        <div class="flex items-center justify-end gap-4">
          <div class="flex items-center gap-2 text-[12px] text-white">
            <span class="opacity-90">
              <span class="font-bold">{{ runningCount }}</span>
              <span> {{ t('sideToolbar.queueProgressOverlay.running') }}</span>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueStore } from '@/stores/queueStore'

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
const commandStore = useCommandStore()

const overlayWidth = computed(() => Math.max(0, Math.round(props.minWidth)))
const overlayStyle = computed(() => {
  const width = `${overlayWidth.value}px`
  return {
    minWidth: width,
    width
  }
})

const runningCount = computed(() => queueStore.runningTasks.length)
const hasHistory = computed(() => queueStore.historyTasks.length > 0)
const isVisible = computed(() => overlayWidth.value > 0 && hasHistory.value)

/** Placeholder: hook real progress data next */
const totalPercent = ref(30)
/** Placeholder: hook real current-node progress next */
const currentNodePercent = ref(60)
const currentNodeName = ref('—')

const viewAllJobs = async () => {
  await commandStore.execute('Workspace_ToggleSidebarTab_queue')
}

const interruptAll = async () => {
  const tasks = queueStore.runningTasks
  for (const task of tasks) {
    await api.interrupt(task.promptId)
  }
}
</script>
