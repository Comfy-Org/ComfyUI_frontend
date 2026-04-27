<script setup lang="ts">
/**
 * LayoutView — App Mode runtime view.
 *
 * Three compositing layers: `.layout-view__background` is the
 * zoom/pan workspace (dot grid + LinearPreview content); AppChrome
 * overlays the grid-anchored system cells; FloatingPanel overlays
 * the inputs panel.
 *
 * The viewport transform lives on `.layout-view__background` so
 * everything inside LinearPreview (welcome copy, dot grid, image,
 * latent preview, arrange view) scales + pans as a single unit.
 * Chrome + panel sit outside that wrapper and stay put.
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

// Reset pan/zoom whenever the selected output changes. Without this,
// switching to a new generation can land you staring at a blank
// workspace because the image you panned away from the last run is
// scrolled off-screen — the new image inherits the same transform.
watch(
  () => linearOutputStore.selectedId,
  () => appModeStore.resetView()
)

// --- Workspace pan/zoom handlers -----------------------------------
// Bound to `.layout-view` (always viewport-sized) rather than the
// inner transformed bgRef, so that zoom-out doesn't shrink the hit
// area and silently break pan/zoom. The math is rect-invariant under
// this swap because the transform is around bgRef's center, which
// coincides with .layout-view's center.
const bgRef = useTemplateRef<HTMLElement>('bgRef')

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  appModeStore.zoomAt(e.clientX, e.clientY, e.deltaY, rect)
}

// Defer pointer capture until the pointer actually moves past a
// threshold — otherwise a click on an in-workspace control (e.g. the
// welcome Run pill) would get swallowed by the drag and never fire
// its click event. DRAG_THRESHOLD matches the one in usePanelDrag.
const DRAG_THRESHOLD_PX = 5
let dragStart: { x: number; y: number; pointerId: number } | null = null
let dragging = false

function handlePointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.button !== 1) return
  dragStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
}

// Window-level pointermove so a drag that leaves the workspace
// (e.g. sweeping out over the chrome) keeps tracking until release.
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

// translate-before-scale: translate values stay in screen-space pixels
// regardless of scale, matching the math in `zoomAt()` and `panBy()`.
// Reversed order would make pan speed shrink as zoom grows.
const workspaceTransform = computed(
  () =>
    `translate(${viewportOffsetX.value}px, ${viewportOffsetY.value}px) ` +
    `scale(${viewportScale.value})`
)

// Dot-grid LOD via two stacked layers (CSS handles the rendering in
// `.layout-view`'s `background-image`). Both layers tile linearly with
// the workspace scale, so they stay locked to the transformed contents
// at all times — the parallax that the old discrete-doubling LOD
// produced is gone. Density management is opacity-based instead: the
// fine 1×-pitch layer fades out as you zoom out, leaving the coarse
// 2×-pitch layer (whose dot positions are a subset of the fine layer's)
// to carry the visual at small scales — so the user perceives
// progressively fewer dots without any of them ever shifting.
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

// Coarse layer is the inverse of fine — fully opaque when fine has
// faded out, fully transparent when fine carries the grid. Without
// this, both layers stack at full opacity above scale=1; the fine
// dots cover the coarse ones, but their anti-aliased edges let the
// coarse dot underneath bleed through, making every-other dot read
// slightly darker than the fine-only ones (two visible values where
// only one was wanted).
const gridCoarseAlpha = computed(() => 1 - gridFineAlpha.value)

// Per-input resolution + block-layout state is shared with the builder
// via useAppPanelLayout — both views read the same `panelRows` from the
// store so WYSIWYG holds across mode switches.
const { inputEntryMap, moveBlock } = useAppPanelLayout()

const panelTitle = computed(() => {
  const path = workflowStore.activeWorkflow?.path
  if (!path) return ''
  return getPathDetails(path).filename
})

// Panel preset + collapse state + block rows live in appModeStore so
// App Mode + App Builder share them; moving / collapsing / rearranging
// in either updates both.
const { panelPreset, panelCollapsed, panelRows } = storeToRefs(appModeStore)

// Which viewport side the panel is docked against. Used to steer the
// welcome-copy offset so the wordmark + body text stay visible on the
// opposite side of the panel, regardless of preset.
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
    <!-- Workspace layer: the viewport transform lives on this inner
         div so the LinearPreview contents (welcome, image, arrange)
         zoom + pan together. Wheel + pointerdown handlers are bound
         to the OUTER `.layout-view` (always viewport-sized) so pan
         and zoom work even when the user has zoomed out and the
         transformed inner div has shrunk to a fraction of the
         viewport — otherwise clicks in the empty area around the
         shrunken workspace miss the listener entirely and pan stops
         responding until a recenter. Chrome + panel are siblings of
         this inner div but children of `.layout-view`; OutputWindow
         and panel headers stop pointerdown propagation so their own
         drags don't double-fire as pans.
         The dot grid is painted on `.layout-view` itself with a
         dynamic background-size + background-position driven by the
         viewport vars above, so the grid pattern visually matches
         the transformed content without the element needing to scale. -->
    <div
      ref="bgRef"
      class="layout-view__background"
      :style="{ transform: workspaceTransform }"
    >
      <LinearPreview hide-chrome />
    </div>

    <!-- Chrome layer: floating utility cells. Shared with the builder. -->
    <AppChrome variant="app-mode" />

    <!-- Overlay layer: a single floating panel, draggable between 6
         preset positions (left/right dock + four float corners).
         Wrapped in `<Transition appear>` so the first paint slides
         + fades the panel into place instead of snapping — a
         cinematic cold-start for demo video and a softer entry on
         every fresh App Mode load. Only runs once per mount; preset
         swaps and collapse toggles are outside this transition. -->
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
  /* Dot grid — two stacked layers tile across the viewport so the
     grid always covers it regardless of zoom. The fine layer (1×
     pitch) sits on top and fades with `--grid-fine-alpha` as you zoom
     out; the coarse layer (2× pitch) is always at full opacity and
     carries the visual at small scales. The coarse layer's positions
     are a subset of the fine's, so fading the fine out leaves a
     subset of the same dots — no jump. Both `background-position`
     entries use `calc(50% + offset)` so the grid shares the same
     pivot as the workspace `transform` (which is `transform-origin:
     center` plus the same offset). With percent-based positioning,
     CSS auto-compensates for the differing image sizes so each
     layer's center dot lands at the same viewport point — making the
     coarse layer's positions perfectly align with every-other fine
     dot. */
  /* Dot radii scale with `--viewport-scale` so the dot-to-tile ratio
     stays constant. Floored at 0.6× so the dots stay visible at
     extreme zoom-out instead of dissolving into sub-pixel noise. The
     anti-aliasing ring (the gap between the solid stop and the
     transparent stop) is pinned to a constant 0.5px regardless of
     zoom — without that pin, zooming in scaled up the AA halo too,
     and the dots read as soft/blurry instead of crisp. */
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
  /* Clip the transformed workspace (+ any other absolute-positioned
     children) to the viewport box so panning out doesn't paint above
     the top workflow-tabs bar. */
  overflow: hidden;
  /* Own stacking context so our z-indexed children (background, grid,
     panel, drag preview) compose cleanly without reaching outside. */
  isolation: isolate;
  /* Reserve the panel's footprint on whichever viewport side it's docked
     against, so LinearWelcome's body copy stays visible on the opposite
     side. LinearWelcome consumes both vars; the panel-free side is 0
     and the panel side is panel-width + outer-padding. Default to
     right-dock for legacy splitter App Mode where --data-panel-side is
     unset. */
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
  /* Flex-column so whichever LinearPreview child is rendered (image
     preview, latent preview, welcome, arrange) can claim `flex-1` and
     fill the workspace. */
  display: flex;
  flex-direction: column;
  /* Transform-origin center so `zoomAt` math (cursor offsets measured
     from the element center) lines up with the visual scale origin. */
  transform-origin: center;
  /* Pan lives on left-click drag across the workspace. Without this
     the browser starts its own selection / drag-image behavior when
     the pointer moves over an <img> or over welcome copy — dragging
     an image to the tab bar creates a new tab with the image URL,
     which was the main UX regression users hit. The nav cluster
     handles explicit zoom/reset, so losing text-select here is a
     fair trade. */
  user-select: none;
  -webkit-user-drag: none;
}

/* Any draggable descendant (images, links) should also opt out of
   native drag — belt and suspenders with the `@dragstart.prevent`
   on the wrapper, since some browsers fire drag before bubbling. */
.layout-view__background :is(img, a) {
  -webkit-user-drag: none;
  user-select: none;
}
</style>

<!--
  Unscoped because Vue's `<Transition appear>` applies the
  `panel-enter-*` classes to the FloatingPanel child component's
  root element, which a scoped selector can't reach without
  `:deep()`. The class prefix is unique to this transition so the
  global footprint is safe.

  Same block also hosts the TEMPORARY App Mode accent colors —
  `:root` placement so they reach AppInput / AppOutput rings that
  teleport to <body> and escape any component-scoped containing
  block. Sole point of definition; tune or revert from here.
-->
<style>
.panel-enter-enter-active {
  transition:
    opacity 300ms ease,
    transform 300ms ease;
}
.panel-enter-enter-from {
  opacity: 0;
  /* Slide in from the right edge — matches the default right-dock
     preset so the entrance reads as "the panel settles into
     position" rather than materializing from nowhere. */
  transform: translateX(16px);
}

/* --- TEMPORARY App Mode color overrides (pending design-system
   integration) ---
   Two color stories live here while we iterate on the App Mode
   palette before promoting either to real semantic tokens:

   1. ACCENT (purple) — selectable / unselected affordance. Replaces
      `primary-background` (design-system blue) in StepBadge,
      AppInput, AppOutput. Lighter shade for fills, deeper shade
      for paired borders.
   2. ACTIVE (yellow) — selected / hover / drag-preview affordance.
      Replaces `warning-background` (design-system gold) across
      App Mode + builder surfaces (AppInput, AppOutput, builder
      ring states, drag-block highlight, welcome-copy emphasis).
      Three opacity variants because Tailwind's slash opacity
      modifier doesn't compose reliably with arbitrary CSS vars.

   When either color graduates to a real semantic token, remove the
   relevant lines below and swap the call-site references to the
   new token. Each call site has a one-line comment pointing back
   here. */
:root {
  --color-app-mode-accent-temp: #6366f1;
  --color-app-mode-accent-temp-deep: #4338ca;
  --color-app-mode-accent-temp-wash: rgb(99 102 241 / 0.3);
  --color-app-mode-active-temp: #edfa78;
  --color-app-mode-active-temp-wash: rgb(237 250 120 / 0.1);
  --color-app-mode-active-temp-half: rgb(237 250 120 / 0.5);
  /* Foreground-on-active: dark gray for icons sitting on top of the
     bright yellow chip (the selected-state checkmarks in AppInput,
     AppOutput, AppBuilder). The previous `text-foreground` /
     `primary-foreground` were near-white and disappeared on yellow. */
  --color-app-mode-active-temp-fg: #1f2937;
}
</style>
