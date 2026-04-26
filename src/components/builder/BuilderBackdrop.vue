<script setup lang="ts">
/**
 * BuilderBackdrop — dot-grid canvas + LinearPreview backdrop for the
 * builder's Preview step. Mirrors LayoutView's backdrop exactly so the
 * Preview visually reads as App Mode: dot-grid canvas color behind,
 * LinearPreview in front (which internally shows LinearArrange's dashed
 * output-area marker in arrange mode, or the actual output when run).
 *
 * Mounts only in the arrange step: during Inputs / Outputs the user
 * clicks on graph-canvas nodes, so the graph has to stay visible.
 * In arrange (Preview), graph interaction isn't meaningful — this
 * backdrop replaces the graph canvas so authors see a clean
 * App-Mode-style preview of where their outputs and inputs will sit.
 *
 * Pan/zoom — same workspace-transform pattern as LayoutView, sharing
 * `appModeStore.viewport*` so the user's zoom level survives a
 * builder ↔ app-mode round trip. AppChrome's nav cluster routes its
 * builder handlers to App Mode actions while `isArrangeMode` is true,
 * so the cluster operates this backdrop instead of the hidden graph.
 */
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import { useAppModeStore } from '@/stores/appModeStore'

const { isArrangeMode } = useAppMode()
const appModeStore = useAppModeStore()
const { viewportScale, viewportOffsetX, viewportOffsetY } =
  storeToRefs(appModeStore)

// --- Workspace pan/zoom (mirrors LayoutView) ---------------------
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
  dragStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
}

useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!dragStart) return
  if (!dragging) {
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
    bgRef.value?.setPointerCapture(dragStart.pointerId)
    dragging = true
  }
  appModeStore.panBy(e.movementX, e.movementY)
})

function endDrag() {
  dragStart = null
  dragging = false
}
useEventListener(window, 'pointerup', endDrag)
useEventListener(window, 'pointercancel', endDrag)

const workspaceTransform = computed(
  () =>
    `translate(${viewportOffsetX.value}px, ${viewportOffsetY.value}px) ` +
    `scale(${viewportScale.value})`
)

// Same LOD-doubling math LayoutView uses — keep the dot grid pitch
// from collapsing into noise when zoomed out, while letting it
// scale up when zoomed in.
const DOT_SIZE_PX = 24
const MIN_GRID_SPACING_PX = 16
const gridSpacing = computed(() => {
  let s = DOT_SIZE_PX * viewportScale.value
  if (!(s > 0)) return DOT_SIZE_PX
  while (s < MIN_GRID_SPACING_PX) s *= 2
  return s
})
</script>

<template>
  <!-- Same dot-grid + canvas-color treatment LayoutView uses so Preview
       reads as App Mode. Sits between the graph canvas (below) and the
       chrome / panel layers (above): z-50 covers the canvas but sits
       under AppChrome (z-1/90), FloatingPanel (z-100), BuilderToolbar
       and BuilderFooterToolbar. Sidebar-width offset keeps the Comfy
       sidebar icon strip visible during arrange. The dot grid lives on
       this outer element with dynamic background-size + position
       driven by the viewport vars — same trick as LayoutView so the
       grid pattern visually matches the transformed content without
       this element itself needing to scale. -->
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
    <!-- Workspace layer: holds the transform + wheel/pointer handlers
         so the cluster (when in arrange mode) and direct gestures
         drive the same `appModeStore.viewport*` state LayoutView
         reads. The dot grid above pans + scales in lockstep. -->
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

<!-- Exception (docs/guidance/vue-components.md §Styling): :deep(*) is
     the only practical way to re-enable pointer events on the slotted
     <LinearPreview> subtree. The root is pointer-events-none so graph/
     chrome clicks fall through empty builder-backdrop space; slotted
     content needs pointer-events-auto so LinearArrange's clickable
     zones still register. We don't own LinearPreview's render tree, so
     we can't push the rule into that component's template. -->
<style scoped>
.builder-backdrop :deep(*) {
  pointer-events: auto;
}
/* The workspace layer is itself a child of the pointer-events-none
   root, so re-enable pointer events here too — wheel + pointerdown
   need to reach our handlers. */
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
