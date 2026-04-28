<script setup lang="ts">
/**
 * App Mode runtime view. Three compositing layers: the zoom/pan
 * workspace (`.layout-view__background`, holds LinearPreview), the
 * grid-anchored AppChrome cells, and the FloatingPanel overlay.
 * Workspace transform lives on the inner div so LinearPreview content
 * scales + pans as one unit; chrome + panel stay put.
 */
import { computed, useTemplateRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventListener } from '@vueuse/core'

import AppChrome from './AppChrome.vue'
import FloatingPanel from './panels/FloatingPanel.vue'
import PanelBlockList from './panels/PanelBlockList.vue'
import { useAppPanelLayout } from './panels/useAppPanelLayout'
import { panelSide as resolvePanelSide } from './panels/panelTypes'

import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { getPathDetails } from '@/utils/formatUtil'
import { useAppModeStore } from '@/stores/appModeStore'

const appModeStore = useAppModeStore()
const workflowStore = useWorkflowStore()
const linearOutputStore = useLinearOutputStore()
const { viewportScale, viewportOffsetX, viewportOffsetY } =
  storeToRefs(appModeStore)

// Reset pan/zoom on selected-output change so a new generation isn't
// scrolled off-screen by the prior run's transform.
watch(
  () => linearOutputStore.selectedId,
  () => appModeStore.resetView()
)

// Pan/zoom handlers bind to the always-full-viewport `.layout-view`,
// not the transformed bgRef — otherwise zoom-out shrinks the hit
// area and pan stops working until a recenter. The zoom math is
// rect-invariant under this swap (same center pivot).
const bgRef = useTemplateRef<HTMLElement>('bgRef')

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  appModeStore.zoomAt(e.clientX, e.clientY, e.deltaY, rect)
}

// Defer pointer capture until past threshold — otherwise a click on
// an in-workspace control (welcome Run pill, etc.) gets swallowed.
const DRAG_THRESHOLD_PX = 5
let dragStart: { x: number; y: number; pointerId: number } | null = null
let dragging = false

function handlePointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.button !== 1) return
  dragStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
}

// Window-level so a drag that leaves the workspace keeps tracking.
useEventListener(window, 'pointermove', (e: PointerEvent) => {
  if (!dragStart) return
  if (!dragging) {
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
    // Capture before flipping `dragging` so a thrown capture doesn't
    // leave the handler in a half-state.
    try {
      bgRef.value?.setPointerCapture(dragStart.pointerId)
    } catch {
      // Some browsers reject capture on non-primary pointers; carry
      // on without it — window listeners still see the events.
    }
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

// translate-before-scale keeps offsets in screen px regardless of
// scale (matches zoomAt/panBy math); reversed would shrink pan speed
// as zoom grows.
const workspaceTransform = computed(
  () =>
    `translate(${viewportOffsetX.value}px, ${viewportOffsetY.value}px) ` +
    `scale(${viewportScale.value})`
)

// Dot-grid LOD: two CSS layers tile linearly with workspace scale
// (no parallax). Density is opacity-driven — the fine 1× layer fades
// out as you zoom out and the coarse 2× layer (a subset of fine
// positions) carries through, so dots disappear without shifting.
const DOT_SIZE_PX = 24

const gridSpacing = computed(() => {
  const s = DOT_SIZE_PX * viewportScale.value
  return s > 0 ? s : DOT_SIZE_PX
})

const gridFineAlpha = computed(() => {
  const s = viewportScale.value
  if (s >= 1) return 1
  if (s <= 0.5) return 0
  return (s - 0.5) * 2
})

// Coarse alpha is inverse of fine — without this, the layers stack
// above scale=1 and the fine dots' AA edges let the coarse dots bleed
// through at every-other position, producing two visible values.
const gridCoarseAlpha = computed(() => 1 - gridFineAlpha.value)

const { inputEntryMap, moveBlock } = useAppPanelLayout()

const panelTitle = computed(() => {
  const path = workflowStore.activeWorkflow?.path
  if (!path) return ''
  return getPathDetails(path).filename
})

const { panelPreset, panelCollapsed, panelRows } = storeToRefs(appModeStore)

// Panel side steers the welcome-copy offset to the opposite edge so
// the wordmark + body text stay visible regardless of preset.
const panelSide = computed(() => resolvePanelSide(panelPreset.value))
</script>

<template>
  <div
    class="layout-view"
    :data-panel-side="panelSide"
    :style="{
      '--viewport-scale': viewportScale,
      '--viewport-offset-x': `${viewportOffsetX}px`,
      '--viewport-offset-y': `${viewportOffsetY}px`,
      '--grid-spacing': `${gridSpacing}px`,
      '--grid-fine-alpha': gridFineAlpha,
      '--grid-coarse-alpha': gridCoarseAlpha
    }"
    @wheel="handleWheel"
    @pointerdown="handlePointerDown"
    @dragstart.prevent
  >
    <!-- Workspace transform lives on this inner div so LinearPreview
         contents (welcome, image, arrange) zoom + pan together. Pan
         handlers are on the outer `.layout-view` so they keep working
         when this div shrinks under zoom-out (OutputWindow + panel
         headers stop propagation so their drags don't double-fire). -->
    <div
      ref="bgRef"
      class="layout-view__background"
      :style="{ transform: workspaceTransform }"
    >
      <LinearPreview hide-chrome />
    </div>

    <AppChrome variant="app-mode" />

    <!-- `<Transition appear>` runs only on first mount — preset swaps
         and collapse toggles bypass it. Soft entry for cold-start. -->
    <Transition name="panel-enter" appear>
      <FloatingPanel
        v-model:preset="panelPreset"
        v-model:collapsed="panelCollapsed"
        :title="panelTitle"
        movable
      >
        <PanelBlockList
          :rows="panelRows"
          :input-entry-map="inputEntryMap"
          @reorder="moveBlock"
        />
      </FloatingPanel>
    </Transition>
  </div>
</template>

<style scoped>
.layout-view {
  position: absolute;
  inset: 0;
  background-color: var(--color-layout-canvas);
  /* Dot grid: two stacked layers (fine 1×, coarse 2×) tile across
     the viewport. `calc(50% + offset)` on background-position shares
     the pivot with the workspace `transform-origin: center` so the
     grid stays locked to the contents — and CSS percent-based
     positioning auto-compensates for the differing image sizes, so
     each layer's center dot lands at the same viewport point.
     Dot radii scale with viewport (constant tile ratio) but floor at
     0.6× to stay visible at extreme zoom-out; the AA ring is pinned
     to a constant 0.5px so dots stay crisp instead of blooming when
     zoomed in. */
  --dot-scale: max(0.6, var(--viewport-scale, 1));
  --dot-radius: calc(1px * var(--dot-scale));
  --dot-fade-radius: calc(var(--dot-radius) + 0.5px);
  background-image:
    radial-gradient(
      circle,
      color-mix(
          in srgb,
          var(--color-layout-grid-dot) calc(100% * var(--grid-fine-alpha, 1)),
          transparent
        )
        var(--dot-radius),
      transparent var(--dot-fade-radius)
    ),
    radial-gradient(
      circle,
      color-mix(
          in srgb,
          var(--color-layout-grid-dot) calc(100% * var(--grid-coarse-alpha, 0)),
          transparent
        )
        var(--dot-radius),
      transparent var(--dot-fade-radius)
    );
  background-size:
    var(--grid-spacing, var(--spacing-layout-dot))
      var(--grid-spacing, var(--spacing-layout-dot)),
    calc(var(--grid-spacing, var(--spacing-layout-dot)) * 2)
      calc(var(--grid-spacing, var(--spacing-layout-dot)) * 2);
  background-position:
    calc(50% + var(--viewport-offset-x, 0))
      calc(50% + var(--viewport-offset-y, 0)),
    calc(50% + var(--viewport-offset-x, 0))
      calc(50% + var(--viewport-offset-y, 0));
  /* Clip the transformed workspace so panning doesn't paint above
     the top workflow-tabs bar. */
  overflow: hidden;
  /* Own stacking context for z-indexed children. */
  isolation: isolate;
  /* LinearWelcome reads both offsets and shifts its copy to the panel-
     free side. Default to right-dock when --data-panel-side is unset. */
  --welcome-panel-offset-left: 0;
  --welcome-panel-offset-right: calc(
    var(--panel-dock-width, 440px) + var(--spacing-layout-outer, 8px)
  );
}

.layout-view[data-panel-side='left'] {
  --welcome-panel-offset-left: calc(
    var(--panel-dock-width, 440px) + var(--spacing-layout-outer, 8px)
  );
  --welcome-panel-offset-right: 0;
}

.layout-view__background {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  flex-direction: column;
  /* Center origin so zoomAt's cursor-offset math lines up with scale. */
  transform-origin: center;
  /* Suppress native image-drag and text-selection so left-click pan
     doesn't fight the browser (dragging an <img> to the tab bar
     opens it as a new tab — the main UX regression we hit). */
  user-select: none;
  -webkit-user-drag: none;
}

/* Belt-and-suspenders for descendants — some browsers fire drag
   before bubbling, so @dragstart.prevent on the wrapper isn't enough. */
.layout-view__background :is(img, a) {
  -webkit-user-drag: none;
  user-select: none;
}
</style>

<!--
  Unscoped: Vue's `<Transition appear>` applies `panel-enter-*` to
  the child component's root, which a scoped selector can't reach
  without :deep(). The class prefix is unique to this transition.
-->
<style>
.panel-enter-enter-active {
  transition:
    opacity 300ms ease,
    transform 300ms ease;
}
.panel-enter-enter-from {
  opacity: 0;
  /* Slide from right edge to match the default right-dock preset —
     reads as "settling into position" rather than materializing. */
  transform: translateX(16px);
}
</style>
