<template>
  <Panel
    class="actionbar w-fit"
    :style="style"
    :class="{ 'is-dragging': isDragging, 'is-docked': isDocked }"
  >
    <div ref="panelRef" class="actionbar-content flex items-center select-none">
      <span ref="dragHandleRef" class="drag-handle cursor-move mr-2 p-0!" />
      <ComfyQueueButton />
    </div>
  </Panel>
</template>

<script lang="ts" setup>
import {
  useDraggable,
  useElementBounding,
  useEventBus,
  useEventListener,
  useLocalStorage,
  watchDebounced
} from '@vueuse/core'
import { clamp } from 'lodash'
import Panel from 'primevue/panel'
import { Ref, computed, inject, nextTick, onMounted, ref, watch } from 'vue'

import { useSettingStore } from '@/stores/settingStore'

import ComfyQueueButton from './ComfyQueueButton.vue'

const settingsStore = useSettingStore()

const visible = computed(
  () => settingsStore.get('Comfy.UseNewMenu') !== 'Disabled'
)

const panelRef = ref<HTMLElement | null>(null)
const dragHandleRef = ref<HTMLElement | null>(null)
const isDocked = useLocalStorage('Comfy.MenuPosition.Docked', false)
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
  containerElement: document.body
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

const topMenuRef = inject<Ref<HTMLDivElement | null>>('topMenuRef')
const topMenuBounds = useElementBounding(topMenuRef)
const overlapThreshold = 20 // pixels
const isOverlappingWithTopMenu = computed(() => {
  if (!panelRef.value) {
    return false
  }
  const { height } = panelRef.value.getBoundingClientRect()
  const actionbarBottom = y.value + height
  const topMenuBottom = topMenuBounds.bottom.value

  const overlapPixels =
    Math.min(actionbarBottom, topMenuBottom) -
    Math.max(y.value, topMenuBounds.top.value)
  return overlapPixels > overlapThreshold
})

watch(isDragging, (newIsDragging) => {
  if (!newIsDragging) {
    // Stop dragging
    isDocked.value = isOverlappingWithTopMenu.value
  } else {
    // Start dragging
    isDocked.value = false
  }
})

const eventBus = useEventBus<string>('topMenu')
watch([isDragging, isOverlappingWithTopMenu], ([dragging, overlapping]) => {
  eventBus.emit('updateHighlight', {
    isDragging: dragging,
    isOverlapping: overlapping
  })
})
</script>

<style scoped>
.actionbar {
  pointer-events: all;
  position: fixed;
  z-index: 1000;
}

.actionbar.is-docked {
  position: static;
  @apply bg-transparent border-none p-0;
}

.actionbar.is-dragging {
  user-select: none;
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

.drag-handle {
  @apply w-3 h-max;
}
</style>
