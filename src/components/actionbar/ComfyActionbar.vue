<template>
  <div class="flex h-full items-center">
    <div
      v-if="isDragging && !isDocked"
      :class="actionbarClass"
      @mouseenter="onMouseEnterDropZone"
      @mouseleave="onMouseLeaveDropZone"
    >
      {{ t('actionbar.dockToTop') }}
    </div>

    <Panel
      class="pointer-events-auto"
      :style="style"
      :class="panelClass"
      :pt="{
        header: { class: 'hidden' },
        content: { class: isDocked ? 'p-0' : 'p-1' }
      }"
    >
      <div ref="panelRef" class="flex items-center select-none gap-2">
        <span
          ref="dragHandleRef"
          :class="
            cn(
              'drag-handle cursor-grab w-3 h-max',
              isDragging && 'cursor-grabbing'
            )
          "
        />
        <Suspense @resolve="comfyRunButtonResolved">
          <ComfyRunButton />
        </Suspense>
        <Button
          v-tooltip.bottom="cancelJobTooltipConfig"
          variant="destructive"
          size="icon"
          :disabled="isExecutionIdle"
          :aria-label="t('menu.interrupt')"
          @click="cancelCurrentJob"
        >
          <i class="icon-[lucide--x] size-4" />
        </Button>
        <Button
          v-tooltip.bottom="clearPendingTasksTooltipConfig"
          variant="destructive"
          size="icon"
          :disabled="!hasPendingTasks"
          text
          :aria-label="$t('menuLabels.Clear Pending Tasks')"
          @click="() => commandStore.execute('Comfy.ClearPendingTasks')"
        >
          <i class="icon-[lucide--list-x] size-4" />
        </Button>
      </div>
    </Panel>
  </div>
</template>

<script lang="ts" setup>
import {
  useDraggable,
  useEventListener,
  useLocalStorage,
  watchDebounced
} from '@vueuse/core'
import { clamp } from 'es-toolkit/compat'
import { storeToRefs } from 'pinia'
import Panel from 'primevue/panel'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

import ComfyRunButton from './ComfyRunButton'

const settingsStore = useSettingStore()
const commandStore = useCommandStore()
const queueCountStore = storeToRefs(useQueuePendingTaskCountStore())
const { t } = useI18n()
const { isIdle: isExecutionIdle } = storeToRefs(useExecutionStore())

const position = computed(() => settingsStore.get('Comfy.UseNewMenu'))
const visible = computed(() => position.value !== 'Disabled')

const tabContainer = document.querySelector('.workflow-tabs-container')
const panelRef = ref<HTMLElement | null>(null)
const dragHandleRef = ref<HTMLElement | null>(null)
const isDocked = useLocalStorage('Comfy.MenuPosition.Docked', true)
const storedPosition = useLocalStorage('Comfy.MenuPosition.Floating', {
  x: 0,
  y: 0
})
const { x, y, style, isDragging } = useDraggable(panelRef, {
  initialValue: { x: 0, y: 0 },
  handle: dragHandleRef,
  containerElement: document.body,
  onMove: (event) => {
    // Prevent dragging the menu over the top of the tabs
    const minY = tabContainer?.getBoundingClientRect().bottom ?? 40
    if (event.y < minY) {
      event.y = minY
    }
  }
})

// Update storedPosition when x or y changes
watchDebounced(
  [x, y],
  ([newX, newY]) => {
    storedPosition.value = { x: newX, y: newY }
  },
  { debounce: 300 }
)

// Set initial position to bottom center
const setInitialPosition = () => {
  if (panelRef.value) {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    const menuWidth = panelRef.value.offsetWidth
    const menuHeight = panelRef.value.offsetHeight

    if (menuWidth === 0 || menuHeight === 0) {
      return
    }

    // Check if stored position exists and is within bounds
    if (storedPosition.value.x !== 0 || storedPosition.value.y !== 0) {
      // Ensure stored position is within screen bounds
      x.value = clamp(storedPosition.value.x, 0, screenWidth - menuWidth)
      y.value = clamp(storedPosition.value.y, 0, screenHeight - menuHeight)
      captureLastDragState()
      return
    }

    // If no stored position or current position, set to bottom center
    if (x.value === 0 && y.value === 0) {
      x.value = clamp((screenWidth - menuWidth) / 2, 0, screenWidth - menuWidth)
      y.value = clamp(
        screenHeight - menuHeight - 10,
        0,
        screenHeight - menuHeight
      )
      captureLastDragState()
    }
  }
}

//The ComfyRunButton is a dynamic import. Which means it will not be loaded onMount in this component.
//So we must use suspense resolve to ensure that is has loaded and updated the DOM before calling setInitialPosition()
async function comfyRunButtonResolved() {
  await nextTick()
  setInitialPosition()
}

watch(visible, async (newVisible) => {
  if (newVisible) {
    await nextTick(setInitialPosition)
  }
})

/**
 * Track run button handle drag start using mousedown on the drag handle.
 */
useEventListener(dragHandleRef, 'mousedown', () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'actionbar_run_handle_drag_start'
  })
})

const lastDragState = ref({
  x: x.value,
  y: y.value,
  windowWidth: window.innerWidth,
  windowHeight: window.innerHeight
})
const captureLastDragState = () => {
  lastDragState.value = {
    x: x.value,
    y: y.value,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight
  }
}
watch(
  isDragging,
  (newIsDragging) => {
    if (!newIsDragging) {
      // Stop dragging
      captureLastDragState()
    }
  },
  { immediate: true }
)

const adjustMenuPosition = () => {
  if (panelRef.value) {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    const menuWidth = panelRef.value.offsetWidth
    const menuHeight = panelRef.value.offsetHeight

    // Calculate distances to all edges
    const distanceLeft = lastDragState.value.x
    const distanceRight =
      lastDragState.value.windowWidth - (lastDragState.value.x + menuWidth)
    const distanceTop = lastDragState.value.y
    const distanceBottom =
      lastDragState.value.windowHeight - (lastDragState.value.y + menuHeight)

    // Find the smallest distance to determine which edge to anchor to
    const distances = [
      { edge: 'left', distance: distanceLeft },
      { edge: 'right', distance: distanceRight },
      { edge: 'top', distance: distanceTop },
      { edge: 'bottom', distance: distanceBottom }
    ]
    const closestEdge = distances.reduce((min, curr) =>
      curr.distance < min.distance ? curr : min
    )

    // Calculate vertical position as a percentage of screen height
    const verticalRatio =
      lastDragState.value.y / lastDragState.value.windowHeight
    const horizontalRatio =
      lastDragState.value.x / lastDragState.value.windowWidth

    // Apply positioning based on closest edge
    if (closestEdge.edge === 'left') {
      x.value = closestEdge.distance // Maintain exact distance from left
      y.value = verticalRatio * screenHeight
    } else if (closestEdge.edge === 'right') {
      x.value = screenWidth - menuWidth - closestEdge.distance // Maintain exact distance from right
      y.value = verticalRatio * screenHeight
    } else if (closestEdge.edge === 'top') {
      x.value = horizontalRatio * screenWidth
      y.value = closestEdge.distance // Maintain exact distance from top
    } else {
      // bottom
      x.value = horizontalRatio * screenWidth
      y.value = screenHeight - menuHeight - closestEdge.distance // Maintain exact distance from bottom
    }

    // Ensure the menu stays within the screen bounds
    x.value = clamp(x.value, 0, screenWidth - menuWidth)
    y.value = clamp(y.value, 0, screenHeight - menuHeight)
  }
}

useEventListener(window, 'resize', adjustMenuPosition)

// Drop zone state
const isMouseOverDropZone = ref(false)

// Mouse event handlers for self-contained drop zone
const onMouseEnterDropZone = () => {
  if (isDragging.value) {
    isMouseOverDropZone.value = true
  }
}

const onMouseLeaveDropZone = () => {
  if (isDragging.value) {
    isMouseOverDropZone.value = false
  }
}

// Handle drag state changes
watch(isDragging, (dragging) => {
  if (dragging) {
    // Starting to drag - undock if docked
    if (isDocked.value) {
      isDocked.value = false
    }
  } else {
    // Stopped dragging - dock if mouse is over drop zone
    if (isMouseOverDropZone.value) {
      isDocked.value = true
    }
    // Reset drop zone state
    isMouseOverDropZone.value = false
  }
})

const cancelJobTooltipConfig = computed(() =>
  buildTooltipConfig(t('menu.interrupt'))
)

const cancelCurrentJob = async () => {
  if (isExecutionIdle.value) return
  await commandStore.execute('Comfy.Interrupt')
}

// Clear pending tasks
const clearPendingTasksTooltipConfig = computed(() =>
  buildTooltipConfig(t('menuLabels.Clear Pending Tasks'))
)

const hasPendingTasks = computed(
  () => queueCountStore.count.value > 1
)

const actionbarClass = computed(() =>
  cn(
    'w-[200px] border-dashed border-blue-500 opacity-80',
    'm-1.5 flex items-center justify-center self-stretch',
    'rounded-md before:w-50 before:-ml-50 before:h-full',
    'pointer-events-auto',
    isMouseOverDropZone.value &&
      'border-[3px] opacity-100 scale-105 shadow-[0_0_20px] shadow-blue-500'
  )
)
const panelClass = computed(() =>
  cn(
    'actionbar pointer-events-auto z-1300',
    isDragging.value && 'select-none pointer-events-none',
    isDocked.value
      ? 'p-0 static border-none bg-transparent'
      : 'fixed shadow-interface'
  )
)
</script>
