<template>
  <div
    class="overflow-hidden transition-all duration-300"
    :class="{
      'max-h-[500px]': isExpanded,
      'max-h-0 p-0 m-0': !isExpanded
    }"
  >
    <div
      ref="sectionsContainerRef"
      class="px-6 py-4 overflow-y-auto max-h-[450px] scroll-container"
      :style="{
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
      }"
      :class="{
        'max-h-[450px]': isExpanded,
        'max-h-0': !isExpanded
      }"
    >
      <div v-for="(panel, index) in taskPanels" :key="index">
        <Panel
          :expanded="collapsedPanels[index] || false"
          toggleable
          class="shadow-elevation-1 rounded-lg mt-2 dark-theme:bg-black dark-theme:border-black"
        >
          <template #header>
            <div class="flex items-center justify-between w-full py-2">
              <div class="flex flex-col text-sm font-medium leading-normal">
                <span>{{ panel.taskName }}</span>
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
              index === taskPanels.length - 1
                ? (el) => (lastPanelRef = el as HTMLElement)
                : undefined
            "
            class="overflow-y-auto h-64 rounded-lg bg-black"
            :class="{
              'h-64': index !== taskPanels.length - 1,
              'flex-grow': index === taskPanels.length - 1
            }"
            @scroll="handleScroll"
          >
            <div class="h-full">
              <div
                v-for="(log, logIndex) in panel.logs"
                :key="logIndex"
                class="text-neutral-400 dark-theme:text-muted"
              >
                <pre class="whitespace-pre-wrap break-words">{{ log }}</pre>
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
} from '@/stores/comfyManagerStore'

const { taskLogs } = useComfyManagerStore()
const progressDialogContent = useManagerProgressDialogStore()
const managerStore = useComfyManagerStore()

const isInProgress = (index: number) =>
  index === taskPanels.value.length - 1 && managerStore.uncompletedCount > 0

const taskPanels = computed(() => taskLogs)
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
const lastPanelLogs = computed(() => taskPanels.value?.at(-1)?.logs)

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
