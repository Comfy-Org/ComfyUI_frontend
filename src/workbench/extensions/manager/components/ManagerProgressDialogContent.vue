<template>
  <div
    class="overflow-hidden transition-all duration-300"
    :class="{
      'max-h-[500px]': isExpanded,
      'm-0 max-h-0 p-0': !isExpanded
    }"
  >
    <div
      ref="sectionsContainerRef"
      class="scroll-container max-h-[450px] overflow-y-auto px-6 py-4"
      :style="{
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
      }"
      :class="{
        'max-h-[450px]': isExpanded,
        'max-h-0': !isExpanded
      }"
    >
      <div v-for="(log, index) in focusedLogs" :key="index">
        <Panel
          :expanded="collapsedPanels[index] === true"
          toggleable
          class="shadow-elevation-1 mt-2 rounded-lg dark-theme:border-black dark-theme:bg-black"
        >
          <template #header>
            <div class="flex w-full items-center justify-between py-2">
              <div class="flex flex-col text-sm leading-normal font-medium">
                <span>{{ log.taskName }}</span>
                <span class="text-muted">
                  {{
                    isInProgress(index)
                      ? $t('g.inProgress')
                      : $t('g.completed') + ' ✓'
                  }}
                </span>
              </div>
            </div>
          </template>
          <template #toggleicon>
            <Button
              :icon="
                collapsedPanels[index]
                  ? 'pi pi-chevron-right'
                  : 'pi pi-chevron-down'
              "
              text
              class="text-neutral-300"
              @click="togglePanel(index)"
            />
          </template>
          <div
            :ref="
              index === focusedLogs.length - 1
                ? (el) => (lastPanelRef = el as HTMLElement)
                : undefined
            "
            class="h-64 overflow-y-auto rounded-lg bg-black"
            :class="{
              'h-64': index !== focusedLogs.length - 1,
              grow: index === focusedLogs.length - 1
            }"
            @scroll="handleScroll"
          >
            <div class="h-full">
              <div
                v-for="(logLine, logIndex) in log.logs"
                :key="logIndex"
                class="text-neutral-400 dark-theme:text-muted"
              >
                <pre class="break-words whitespace-pre-wrap">{{ logLine }}</pre>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useScroll, whenever } from '@vueuse/core'
import Button from 'primevue/button'
import Panel from 'primevue/panel'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import {
  useComfyManagerStore,
  useManagerProgressDialogStore
} from '@/workbench/extensions/manager/stores/comfyManagerStore'

const comfyManagerStore = useComfyManagerStore()
const progressDialogContent = useManagerProgressDialogStore()

const isInProgress = (index: number) => {
  const log = focusedLogs.value[index]
  if (!log) return false

  // Check if this task is in the running or pending queue
  const taskQueue = comfyManagerStore.taskQueue
  if (!taskQueue) return false

  const allQueueTasks = [
    ...(taskQueue.running_queue || []),
    ...(taskQueue.pending_queue || [])
  ]

  return allQueueTasks.some((task) => task.ui_id === log.taskId)
}

const focusedLogs = computed(() => {
  if (progressDialogContent.getActiveTabIndex() === 0) {
    return comfyManagerStore.succeededTasksLogs
  }
  return comfyManagerStore.failedTasksLogs
})
const isExpanded = computed(() => progressDialogContent.isExpanded)
const isCollapsed = computed(() => !isExpanded.value)

const collapsedPanels = ref<Record<number, boolean>>({})
const togglePanel = (index: number) => {
  collapsedPanels.value[index] = !collapsedPanels.value[index]
}

const sectionsContainerRef = ref<HTMLElement | null>(null)
const { y: scrollY } = useScroll(sectionsContainerRef, {
  eventListenerOptions: {
    passive: true
  }
})

const lastPanelRef = ref<HTMLElement | null>(null)
const isUserScrolling = ref(false)
const lastPanelLogs = computed(() => focusedLogs.value?.at(-1)?.logs)

const isAtBottom = (el: HTMLElement | null) => {
  if (!el) return false
  const threshold = 20
  return Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < threshold
}

const scrollLastPanelToBottom = () => {
  if (!lastPanelRef.value || isUserScrolling.value) return
  lastPanelRef.value.scrollTop = lastPanelRef.value.scrollHeight
}
const scrollContentToBottom = () => {
  scrollY.value = sectionsContainerRef.value?.scrollHeight ?? 0
}

const resetUserScrolling = () => {
  isUserScrolling.value = false
}
const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  if (target !== lastPanelRef.value) return

  isUserScrolling.value = !isAtBottom(target)
}

const onLogsAdded = () => {
  // If user is scrolling manually, don't automatically scroll to bottom
  if (isUserScrolling.value) return

  scrollLastPanelToBottom()
}

whenever(lastPanelLogs, onLogsAdded, { flush: 'post', deep: true })
whenever(() => isExpanded.value, scrollContentToBottom)
whenever(isCollapsed, resetUserScrolling)

onMounted(() => {
  scrollContentToBottom()
})

onBeforeUnmount(() => {
  progressDialogContent.collapse()
})
</script>
