<template>
  <div class="flex h-full items-center">
    <div
      v-if="isDragging && !isDocked"
      class="actionbar-drop-zone m-1.5 flex items-center justify-center self-stretch rounded-md"
      :class="{
        'drop-zone-active': isMouseOverDropZone
      }"
      @mouseenter="onMouseEnterDropZone"
      @mouseleave="onMouseLeaveDropZone"
    >
      {{ t('actionbar.dockToTop') }}
    </div>

    <Panel
      class="actionbar"
      :style="style"
      :class="{
        fixed: !isDocked,
        'is-dragging': isDragging,
        'is-docked static mr-2 border-none bg-transparent p-0': isDocked
      }"
    >
      <div
        ref="panelRef"
        class="actionbar-content flex items-center select-none"
      >
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
import Panel from 'primevue/panel'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { cn } from '@/utils/tailwindUtil'

import ComfyRunButton from './ComfyRunButton'

const settingsStore = useSettingStore()

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
const {
  x,
  y,
  style: style,
  isDragging
} = useDraggable(panelRef, {
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
onMounted(setInitialPosition)
watch(visible, async (newVisible) => {
  if (newVisible) {
    await nextTick(setInitialPosition)
  }
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
</script>

<style scoped>
@reference '../../assets/css/style.css';

.actionbar {
  pointer-events: all;
  z-index: 1000;
}

.actionbar-drop-zone {
  width: 265px;
  border: 2px dashed var(--p-primary-color);
  opacity: 0.8;
}

.actionbar-drop-zone.drop-zone-active {
  background: var(--p-highlight-background-focus);
  border-color: var(--p-primary-color);
  border-width: 3px;
  box-shadow: 0 0 20px var(--p-primary-color);
  opacity: 1;
  transform: scale(1.05);
}

.actionbar.is-dragging {
  user-select: none;
  pointer-events: none;
}

:deep(.p-panel-content) {
  @apply p-1;
}

.is-docked :deep(.p-panel-content) {
  @apply p-0;
}

:deep(.p-panel-header) {
  display: none;
}
</style>
