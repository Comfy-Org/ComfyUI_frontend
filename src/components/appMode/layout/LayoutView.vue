<script setup lang="ts">
import { computed, ref, useTemplateRef, watch, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import {
  useElementBounding,
  useElementSize,
  useEventListener
} from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import AppChrome from './AppChrome.vue'
import FloatingPanel from './panels/FloatingPanel.vue'
import PanelBlockList from './panels/PanelBlockList.vue'
import { useAppPanelLayout } from './panels/useAppPanelLayout'

import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import { useOutputWindowStore } from '@/renderer/extensions/linearMode/outputWindowStore'
import { useAppModeStore } from '@/stores/appModeStore'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const windowStore = useOutputWindowStore()
const { viewportScale, viewportOffsetX, viewportOffsetY, noZoomMode } =
  storeToRefs(appModeStore)

// Pan/zoom binds to .layout-view (full viewport), not the transformed
// bgRef — otherwise zoom-out shrinks the hit area.
const bgRef = useTemplateRef<HTMLElement>('bgRef')
const layoutRef = useTemplateRef<HTMLElement>('layoutRef')

// Dashboard mode: re-flow tiles whenever the view size, tile count,
// or mode changes. Reading the LayoutView rect avoids assumptions
// about sidebar widths.
const { width: layoutW, height: layoutH } = useElementSize(layoutRef)

// Measure the input panel's actual rendered rect so the dashboard
// packer reserves exactly the cells it covers — same code path for
// full-height docks and corner floats. Re-measures whenever the
// panel preset or collapsed state changes (which can re-mount it).
const panelDomEl = ref<HTMLElement | null>(null)
watchEffect(() => {
  void appModeStore.panelPreset
  void appModeStore.panelCollapsed
  panelDomEl.value =
    layoutRef.value?.querySelector<HTMLElement>('.floating-panel') ?? null
})
const {
  x: panelX,
  y: panelY,
  width: panelWidth,
  height: panelHeight
} = useElementBounding(panelDomEl)
const { x: layoutLeft, y: layoutTop } = useElementBounding(layoutRef)

const dashboardInsets = computed(() => {
  if (!panelDomEl.value || panelWidth.value === 0) return {}
  return {
    panelRect: {
      x: panelX.value - layoutLeft.value,
      y: panelY.value - layoutTop.value,
      w: panelWidth.value,
      h: panelHeight.value
    }
  }
})

// Smooth-pan to each new output window so prior run's transform
// doesn't leave it off-screen. flyTo preserves zoom unless it's far
// off. Skipped in dashboard mode — viewport is locked, tile lives
// where it spawned.
//
// First-tile zoom-mode placement matches no-zoom N=1: corner
// opposite the panel, bounded-fit to avail. So a single output
// reads as the focus tile in either mode.
const FALLBACK_W = 512
const FALLBACK_H = 560
watch(
  () => windowStore.windows.length,
  (next, prev) => {
    if (next <= (prev ?? 0)) return
    if (noZoomMode.value) return
    const isFirstTile = next === 1 && (prev ?? 0) === 0
    if (
      isFirstTile &&
      layoutW.value > 0 &&
      layoutH.value > 0 &&
      dashboardInsets.value.panelRect
    ) {
      windowStore.placeFirstZoomTile(
        layoutW.value,
        layoutH.value,
        dashboardInsets.value
      )
      // Skip flyTo here: the tile is already in its panel-opposite
      // corner slot. flyTo would pan to center it in the viewport,
      // and "viewport center" partially lands under the input panel
      // (~440px wide on the right). Leaving the viewport at its
      // default transform keeps the tile flush in the same position
      // it would occupy in no-zoom mode.
      return
    }
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

// Quantize the panel rect to cell-grid buckets so a panel drag
// only triggers a relayout when it crosses a cell boundary.
// useElementBounding fires on every pixel of movement; without
// this, every mousemove during a panel drag re-runs the dashboard
// packer + re-renders every output window — looks like a freeze.
const CHROME_STEP_PX = 56
const dashboardInsetsKey = computed(() => {
  const pr = dashboardInsets.value.panelRect
  if (!pr) return 'no-panel'
  const pStart = Math.round(pr.x / CHROME_STEP_PX)
  const pEnd = Math.round((pr.x + pr.w) / CHROME_STEP_PX)
  return `${pStart},${pEnd}`
})

watch(
  [
    () => windowStore.windows.length,
    () => windowStore.windows.map((w) => w.aspect ?? 0).join(','),
    layoutW,
    layoutH,
    dashboardInsetsKey,
    noZoomMode
  ],
  () => {
    if (!noZoomMode.value) return
    const count = windowStore.windows.length
    if (count === 0 || layoutW.value <= 0 || layoutH.value <= 0) return
    // Pass the full pixel-accurate insets so boundary-snap math
    // still aligns to the panel's actual edge.
    windowStore.relayoutDashboard(
      layoutW.value,
      layoutH.value,
      dashboardInsets.value
    )
  },
  // sync flush: re-flow runs in the same tick as the spawn, so the
  // new tile renders directly at its dashboard slot.
  { flush: 'sync', immediate: true }
)

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  appModeStore.zoomAt(e.clientX, e.clientY, e.deltaY, rect)
}

// Threshold guards against swallowing clicks on in-workspace controls.
const DRAG_THRESHOLD_PX = 5
let dragStart: { x: number; y: number; pointerId: number } | null = null
let dragging = false

function handlePointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.button !== 1) return
  dragStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
}

// Window-level so a drag leaving the workspace keeps tracking.
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
  dragStart = null
  dragging = false
}
useEventListener(window, 'pointerup', endDrag)
useEventListener(window, 'pointercancel', endDrag)

// translate-before-scale keeps offsets in screen px regardless of zoom.
const workspaceTransform = computed(
  () =>
    `translate(${viewportOffsetX.value}px, ${viewportOffsetY.value}px) ` +
    `scale(${viewportScale.value})`
)

const { inputEntryMap, moveBlock } = useAppPanelLayout()

const panelTitle = computed(() => t('linearMode.inputs.title'))

const { panelPreset, panelCollapsed, panelRows } = storeToRefs(appModeStore)
</script>

<template>
  <div
    ref="layoutRef"
    class="layout-view"
    :style="{
      '--viewport-scale': viewportScale,
      '--viewport-offset-x': `${viewportOffsetX}px`,
      '--viewport-offset-y': `${viewportOffsetY}px`
    }"
    @wheel="handleWheel"
    @pointerdown="handlePointerDown"
    @dragstart.prevent
  >
    <!-- Transform on the inner div; pan handlers stay on the outer
         .layout-view so they keep working under zoom-out. -->
    <div
      ref="bgRef"
      class="layout-view__background"
      :style="{ transform: workspaceTransform }"
    >
      <LinearPreview hide-chrome />
    </div>

    <AppChrome variant="app-mode" />

    <!-- `appear` for cold-start only; preset/collapse changes bypass. -->
    <!-- TODO: dragging the panel in no-zoom mode crashes the app
         (some interaction between the panel preset transition,
         useElementBounding, and the dashboard relayout). Movement
         in no-zoom is disabled until that's fixed; in zoom mode
         dragging works. Should be re-enabled once the dashboard
         layout can absorb a panel side-switch cleanly. -->
    <Transition name="panel-enter" appear>
      <FloatingPanel
        v-model:preset="panelPreset"
        v-model:collapsed="panelCollapsed"
        :title="panelTitle"
        :movable="!noZoomMode"
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
  overflow: hidden;
  isolation: isolate;
  /* Dot grid: one dot per chrome cell center. Lives on .layout-view
     (not .layout-view__background) so the pattern always tiles to
     the viewport edges, and the canvas transform is mirrored
     manually below so the dots stay aligned with bgRef's content
     when the user zooms or pans. The first dot lands at canvas
     (outer + cell/2) and the spacing is one chrome step. */
  --cell-anchor: calc(
    var(--spacing-layout-outer) + var(--spacing-layout-cell) / 2
  );
  --cell-step: calc(var(--spacing-layout-cell) + var(--spacing-layout-gutter));
  --dot-scale: max(0.6, var(--viewport-scale, 1));
  --dot-radius: calc(1px * var(--dot-scale));
  --dot-fade-radius: calc(var(--dot-radius) + 0.5px);
  background-image: radial-gradient(
    circle,
    var(--color-layout-grid-dot) var(--dot-radius),
    transparent var(--dot-fade-radius)
  );
  background-size: calc(var(--cell-step) * var(--viewport-scale, 1))
    calc(var(--cell-step) * var(--viewport-scale, 1));
  /* Mirror bgRef's `translate(offset) scale(s)` with origin = center.
     Canvas (anchor, anchor) lands at viewport
     ((1 − s)·50% + s·anchor + offset). */
  background-position: calc(
      (1 - var(--viewport-scale, 1)) * 50% + var(--cell-anchor) *
        var(--viewport-scale, 1) + var(--viewport-offset-x, 0)
    )
    calc(
      (1 - var(--viewport-scale, 1)) * 50% + var(--cell-anchor) *
        var(--viewport-scale, 1) + var(--viewport-offset-y, 0)
    );
}

.layout-view__background {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  flex-direction: column;
  /* Center origin so zoomAt's cursor-offset math lines up with scale. */
  transform-origin: center;
  /* Block native drag/selection so left-click pan doesn't fight the
     browser (dragging an <img> opens it as a new tab). */
  user-select: none;
  -webkit-user-drag: none;
}

/* @dragstart.prevent on the wrapper doesn't catch all browsers. */
.layout-view__background :is(img, a) {
  -webkit-user-drag: none;
  user-select: none;
}
</style>

<style>
/* `<style>` block exception: Vue's <Transition appear name="panel-enter">
   generates `panel-enter-enter-*` class names on the child's root at
   runtime, so Tailwind utility classes on the template can't reach them.
   The block is unscoped so the transition classes match across the
   slot boundary. The doubled `enter-enter` is intentional — the
   transition is named "panel-enter" and Vue appends "-enter-active"
   etc. */
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
