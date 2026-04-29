<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventListener } from '@vueuse/core'

import AppChrome from './AppChrome.vue'
import FloatingPanel from './panels/FloatingPanel.vue'
import PanelBlockList from './panels/PanelBlockList.vue'
import { useAppPanelLayout } from './panels/useAppPanelLayout'
import { panelSide as resolvePanelSide } from './panels/panelTypes'

import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import { useOutputWindowStore } from '@/renderer/extensions/linearMode/outputWindowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { getPathDetails } from '@/utils/formatUtil'
import { useAppModeStore } from '@/stores/appModeStore'

const appModeStore = useAppModeStore()
const workflowStore = useWorkflowStore()
const windowStore = useOutputWindowStore()
const { viewportScale, viewportOffsetX, viewportOffsetY } =
  storeToRefs(appModeStore)

// Smooth-pan to a new output window on spawn so the user lands on the
// fresh content without the previous run's transform leaving it off-
// screen. flyTo keeps the current zoom unless it's WAY off.
const FALLBACK_W = 512
const FALLBACK_H = 560
watch(
  () => windowStore.windows.length,
  (next, prev) => {
    if (next <= (prev ?? 0)) return
    const latest = windowStore.windows[windowStore.windows.length - 1]
    if (!latest) return
    appModeStore.flyTo({
      x: latest.position.x,
      y: latest.position.y,
      width: latest.width ?? FALLBACK_W,
      height: latest.height ?? FALLBACK_H
    })
  }
)

// Pan/zoom handlers bind to `.layout-view` (always full viewport), not
// the transformed bgRef — otherwise zoom-out shrinks the hit area.
const bgRef = useTemplateRef<HTMLElement>('bgRef')

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  appModeStore.zoomAt(e.clientX, e.clientY, e.deltaY, rect)
}

// Defer capture until past threshold so clicks on in-workspace
// controls (welcome Run pill, etc.) aren't swallowed.
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
    try {
      bgRef.value?.setPointerCapture(dragStart.pointerId)
    } catch {
      // Some browsers reject capture on non-primary pointers; window
      // listeners still see the events, so carry on.
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
// scale (matches zoomAt/panBy math).
const workspaceTransform = computed(
  () =>
    `translate(${viewportOffsetX.value}px, ${viewportOffsetY.value}px) ` +
    `scale(${viewportScale.value})`
)

// Dot-grid LOD: two opacity-cross-faded CSS layers (fine 1×, coarse
// 2×). Coarse positions are a subset of fine, so dots disappear at
// zoom-out without shifting.
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

// Inverse of fine — without this, AA edges leak the coarse layer
// through at every-other position above scale=1.
const gridCoarseAlpha = computed(() => 1 - gridFineAlpha.value)

const { inputEntryMap, moveBlock } = useAppPanelLayout()

const panelTitle = computed(() => {
  const path = workflowStore.activeWorkflow?.path
  if (!path) return ''
  return getPathDetails(path).filename
})

const { panelPreset, panelCollapsed, panelRows } = storeToRefs(appModeStore)

// Steers the welcome-copy offset to the panel-free edge.
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
    <!-- Transform on the inner div so LinearPreview contents zoom +
         pan together while pan handlers (on the outer .layout-view)
         keep working under zoom-out. -->
    <div
      ref="bgRef"
      class="layout-view__background"
      :style="{ transform: workspaceTransform }"
    >
      <LinearPreview hide-chrome />
    </div>

    <AppChrome variant="app-mode" />

    <!-- `appear` so cold-start gets a soft entry; preset swaps + collapse
         toggles bypass this transition. -->
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
  /* Dot grid shares the workspace pivot via `calc(50% + offset)`. Dot
     radii scale with viewport but floor at 0.6× for legibility at
     extreme zoom-out; the AA ring stays at 0.5px so dots don't bloom. */
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
  overflow: hidden;
  isolation: isolate;
  /* LinearWelcome reads these to shift its copy to the panel-free
     side; defaults assume the right-dock preset. */
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
  /* Suppress native drag/selection so left-click pan doesn't fight
     the browser (dragging an <img> opens it as a new tab). */
  user-select: none;
  -webkit-user-drag: none;
}

/* Some browsers fire drag before bubbling, so @dragstart.prevent on
   the wrapper isn't enough — repeat on descendants. */
.layout-view__background :is(img, a) {
  -webkit-user-drag: none;
  user-select: none;
}
</style>

<!-- Unscoped: <Transition appear> applies these classes to the child
     component's root, which scoped selectors can't reach. -->
<style>
.panel-enter-enter-active {
  transition:
    opacity 300ms ease,
    transform 300ms ease;
}
.panel-enter-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
</style>
