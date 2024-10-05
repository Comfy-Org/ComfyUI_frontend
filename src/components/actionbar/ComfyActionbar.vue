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
      <Divider layout="vertical" class="mx-1" />
      <ButtonGroup class="flex flex-nowrap">
        <Button
          v-tooltip.bottom="$t('menu.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          text
          @click="() => commandStore.execute('Comfy.RefreshNodeDefinitions')"
        />
      </ButtonGroup>
    </div>
  </Panel>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, onMounted, Ref, ref, watch } from 'vue'
import Panel from 'primevue/panel'
import Divider from 'primevue/divider'
import Button from 'primevue/button'
import ButtonGroup from 'primevue/buttongroup'
import ComfyQueueButton from './ComfyQueueButton.vue'
import { useSettingStore } from '@/stores/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import {
  useDraggable,
  useElementBounding,
  useEventListener,
  useLocalStorage,
  watchDebounced
} from '@vueuse/core'
import { clamp } from 'lodash'

const settingsStore = useSettingStore()
const commandStore = useCommandStore()

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
  }
}
onMounted(setInitialPosition)
watch(visible, (newVisible) => {
  if (newVisible) {
    nextTick(setInitialPosition)
  }
})

const adjustMenuPosition = () => {
  if (panelRef.value) {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    const menuWidth = panelRef.value.offsetWidth
    const menuHeight = panelRef.value.offsetHeight

    // Adjust x position if menu is off-screen horizontally
    x.value = clamp(x.value, 0, screenWidth - menuWidth)

    // Adjust y position if menu is off-screen vertically
    y.value = clamp(y.value, 0, screenHeight - menuHeight)
  }
}

useEventListener(window, 'resize', adjustMenuPosition)

const topMenuRef = inject<Ref<HTMLDivElement | null>>('topMenuRef')
const topMenuBounds = useElementBounding(topMenuRef)
const overlapThreshold = 20 // pixels
const getIsOverlappingWithTopMenu = () => {
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
}

watch(isDragging, (newIsDragging) => {
  if (!newIsDragging) {
    // Stop dragging
    isDocked.value = getIsOverlappingWithTopMenu()
  } else {
    // Start dragging
    isDocked.value = false
  }
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
