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
          :expanded="expandedPanels[index] || false"
          toggleable
          class="shadow-elevation-1 rounded-lg mt-2 dark-theme:bg-black dark-theme:border-black"
        >
          <template #header>
            <div class="flex items-center justify-between w-full py-2">
              <div class="flex flex-col text-sm font-medium leading-normal">
                <span>{{ panel.taskName }}</span>
                <span v-show="expandedPanels[index]" class="text-muted">
                  {{
                    index === taskPanels.length - 1
                      ? 'In progress'
                      : 'Completed ✓'
                  }}
                </span>
              </div>
            </div>
          </template>
          <template #toggleicon>
            <Button
              :icon="
                expandedPanels[index]
                  ? 'pi pi-chevron-down'
                  : 'pi pi-chevron-right'
              "
              text
              class="text-neutral-300"
              @click="togglePanel(index)"
            />
          </template>
          <div
            class="overflow-y-auto h-64 rounded-lg bg-black"
            :class="{
              'h-64': index !== taskPanels.length - 1,
              'flex-grow': index === taskPanels.length - 1
            }"
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

const taskPanels = computed(() => taskLogs)
const isExpanded = computed(() => progressDialogContent.isExpanded)

const expandedPanels = ref<Record<number, boolean>>({})
const togglePanel = (index: number) => {
  expandedPanels.value[index] = !expandedPanels.value[index]
}

const sectionsContainerRef = ref<HTMLElement | null>(null)
const { y: scrollY } = useScroll(sectionsContainerRef)

const scrollToBottom = () => {
  scrollY.value = sectionsContainerRef.value?.scrollHeight ?? 0
}

whenever(() => isExpanded.value, scrollToBottom)
onMounted(() => {
  expandedPanels.value = {}
  scrollToBottom()
})

onBeforeUnmount(() => {
  progressDialogContent.collapse()
})
</script>
