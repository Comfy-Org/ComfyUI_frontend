<template>
  <Panel
    class="actionbar w-fit"
    :style="style"
    :class="{ 'is-dragging': isDragging, 'is-docked': isDocked }"
  >
    <div class="actionbar-content flex items-center" ref="panelRef">
      <span class="drag-handle cursor-move mr-2 p-0!" ref="dragHandleRef">
      </span>
      <ComfyQueueButton />
    </div>
  </Panel>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, onMounted, Ref, ref, watch } from 'vue'
import Panel from 'primevue/panel'
import ComfyQueueButton from './ComfyQueueButton.vue'
import { useSettingStore } from '@/stores/settingStore'
import {
  useDraggable,
  useElementBounding,
  useEventBus,
  useEventListener,
  useLocalStorage,
  watchDebounced
} from '@vueuse/core'
import { clamp } from 'lodash'

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
  if (x.value !== 0 || y.value !== 0) {
    return
  }
  if (storedPosition.value.x !== 0 || storedPosition.value.y !== 0) {
    x.value = storedPosition.value.x
    y.value = storedPosition.value.y
    captureLastDragState()
    return
  }
  if (panelRef.value) {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    const menuWidth = panelRef.value.offsetWidth
    const menuHeight = panelRef.value.offsetHeight

    if (menuWidth === 0 || menuHeight === 0) {
      return
    }

    x.value = (screenWidth - menuWidth) / 2
    y.value = screenHeight - menuHeight - 10 // 10px margin from bottom
    captureLastDragState()
  }
}
onMounted(setInitialPosition)
watch(visible, (newVisible) => {
  if (newVisible) {
    nextTick(setInitialPosition)
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

    // Calculate the distance from each edge
    const distanceRight =
      lastDragState.value.windowWidth - (lastDragState.value.x + menuWidth)
    const distanceBottom =
      lastDragState.value.windowHeight - (lastDragState.value.y + menuHeight)

    // Determine if the menu is closer to right/bottom or left/top
    const anchorRight = distanceRight < lastDragState.value.x
    const anchorBottom = distanceBottom < lastDragState.value.y

    // Calculate new position
    if (anchorRight) {
      x.value =
        screenWidth - (lastDragState.value.windowWidth - lastDragState.value.x)
    } else {
      x.value = lastDragState.value.x
    }

    if (anchorBottom) {
      y.value =
        screenHeight -
        (lastDragState.value.windowHeight - lastDragState.value.y)
    } else {
      y.value = lastDragState.value.y
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

:deep(.p-panel-header) {
  display: none;
}
</style>
