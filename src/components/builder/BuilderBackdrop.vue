<script setup lang="ts">
import { useEventListener, useWindowFocus } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef, watch } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import { useAppModeStore } from '@/stores/appModeStore'

const { isArrangeMode } = useAppMode()
const appModeStore = useAppModeStore()
const { viewportScale, viewportOffsetX, viewportOffsetY } =
  storeToRefs(appModeStore)

const bgRef = useTemplateRef<HTMLElement>('bgRef')

function handleWheel(e: WheelEvent) {
  const el = bgRef.value
  if (!el) return
  e.preventDefault()
  appModeStore.zoomAt(
    e.clientX,
    e.clientY,
    e.deltaY,
    el.getBoundingClientRect()
  )
}

const DRAG_THRESHOLD_PX = 5
let dragStart: { x: number; y: number; pointerId: number } | null = null
let dragging = false

function handlePointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.button !== 1) return
  e.preventDefault()
  dragStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
}

useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!dragStart) return
  if (!dragging) {
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
    try {
      bgRef.value?.setPointerCapture(dragStart.pointerId)
    } catch {
      // Some browsers reject capture on non-primary pointers.
    }
    dragging = true
  }
  appModeStore.panBy(e.movementX, e.movementY)
})

function endDrag() {
  if (dragStart && dragging) {
    try {
      bgRef.value?.releasePointerCapture(dragStart.pointerId)
    } catch {
      // pointer may already be released
    }
  }
  dragStart = null
  dragging = false
}
useEventListener(window, 'pointerup', endDrag)
useEventListener(window, 'pointercancel', endDrag)

// Abandon on blur — pointerup may never arrive after alt-tab.
const focused = useWindowFocus()
watch(focused, (nowFocused) => {
  if (!nowFocused && dragStart !== null) endDrag()
})

const workspaceTransform = computed(
  () =>
    `translate(${viewportOffsetX.value}px, ${viewportOffsetY.value}px) ` +
    `scale(${viewportScale.value})`
)

const DOT_SIZE_PX = 24
const MIN_GRID_SPACING_PX = 16
// LOD-double the pitch so the grid doesn't collapse into noise.
const gridSpacing = computed(() => {
  let s = DOT_SIZE_PX * viewportScale.value
  if (!(s > 0)) return DOT_SIZE_PX
  while (s < MIN_GRID_SPACING_PX) s *= 2
  return s
})
</script>

<template>
  <!-- z-50 above graph canvas, below AppChrome / FloatingPanel / toolbar. -->
  <div
    v-if="isArrangeMode"
    :class="[
      'builder-backdrop pointer-events-none fixed z-50 overflow-hidden',
      'top-(--workflow-tabs-height) right-0 bottom-0',
      'left-(--sidebar-width,0px)',
      'bg-layout-canvas',
      'bg-[radial-gradient(circle,var(--color-layout-grid-dot)_1px,transparent_1.5px)]'
    ]"
    :style="{
      backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
      backgroundPosition: `${viewportOffsetX}px ${viewportOffsetY}px`
    }"
  >
    <div
      ref="bgRef"
      class="builder-backdrop__workspace absolute inset-0 flex flex-col"
      :style="{ transform: workspaceTransform }"
      @wheel="handleWheel"
      @pointerdown="handlePointerDown"
      @dragstart.prevent
    >
      <LinearPreview hide-chrome />
    </div>
  </div>
</template>

<!-- :deep(*) override; documented exception in docs/guidance/vue-components.md. -->
<style scoped>
.builder-backdrop :deep(*) {
  pointer-events: auto;
}
.builder-backdrop__workspace {
  pointer-events: auto;
  transform-origin: center;
  user-select: none;
  -webkit-user-drag: none;
}
.builder-backdrop__workspace :is(img, a) {
  -webkit-user-drag: none;
  user-select: none;
}
</style>
