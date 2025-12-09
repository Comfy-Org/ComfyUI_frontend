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
      <div ref="panelRef" class="flex items-center select-none">
        <span
          ref="dragHandleRef"
          :class="
            cn(
              'drag-handle cursor-grab w-3 h-max mr-2',
              isDragging && 'cursor-grabbing'
            )
          "
        />

        <ComfyRunButton />
        <IconButton
          v-tooltip.bottom="cancelJobTooltipConfig"
          type="transparent"
          size="sm"
          class="ml-2 bg-destructive-background text-base-foreground transition-colors duration-200 ease-in-out hover:bg-destructive-background-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive-background"
          :disabled="isExecutionIdle"
          :aria-label="t('menu.interrupt')"
          @click="cancelCurrentJob"
        >
          <i class="icon-[lucide--x] size-4" />
        </IconButton>
        <IconTextButton
          v-tooltip.bottom="queueHistoryTooltipConfig"
          size="sm"
          type="secondary"
          icon-position="right"
          data-testid="queue-toggle-button"
          class="ml-2 h-8 border-0 px-3 text-sm font-medium text-base-foreground cursor-pointer"
          :aria-pressed="props.queueOverlayExpanded"
          :aria-label="queueToggleLabel"
          :label="queueToggleLabel"
          @click="toggleQueueOverlay"
        >
          <template #icon>
            <i class="icon-[lucide--chevron-down] size-4" />
          </template>
        </IconTextButton>
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import IconTextButton from '@/components/button/IconTextButton.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

import ComfyRunButton from './ComfyRunButton'

const props = defineProps<{
  queueOverlayExpanded: boolean
}>()

const emit = defineEmits<{
  (e: 'update:queueOverlayExpanded', value: boolean): void
}>()

const settingsStore = useSettingStore()
const executionStore = useExecutionStore()
const commandStore = useCommandStore()
const queueStore = useQueueStore()

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

// Queue and Execution logic
const { isIdle: isExecutionIdle } = storeToRefs(executionStore)
const queuedCount = computed(() => queueStore.pendingTasks.length)
const queueToggleLabel = computed(() =>
  t('sideToolbar.queueProgressOverlay.toggleLabel', {
    count: queuedCount.value
  })
)
const queueHistoryTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.viewJobHistory'))
)
const cancelJobTooltipConfig = computed(() =>
  buildTooltipConfig(t('menu.interrupt'))
)

const toggleQueueOverlay = () => {
  emit('update:queueOverlayExpanded', !props.queueOverlayExpanded)
}

const cancelCurrentJob = async () => {
  if (isExecutionIdle.value) return
  await commandStore.execute('Comfy.Interrupt')
}

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
onMounted(setInitialPosition)
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
      ? 'p-0 static mr-2 border-none bg-transparent'
      : 'fixed shadow-interface'
  )
)
</script>
