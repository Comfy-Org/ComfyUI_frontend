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

// Dot-grid LOD — the visible grid pitch scales with content while we
// zoom in (fewer dots per viewport = feels like zooming in), but as
// we zoom out we double the pitch whenever it would fall below a
// density threshold so the viewport doesn't fill with visual noise.
// Doubling keeps alignment with the previous level (every other dot
// survives), so a "world point" under a dot stays under a dot after
// the snap. Matches the CSS `--spacing-layout-dot` (24px) at scale=1.
const DOT_SIZE_PX = 24
const MIN_GRID_SPACING_PX = 16

const gridSpacing = computed(() => {
  let s = DOT_SIZE_PX * viewportScale.value
  if (!(s > 0)) return DOT_SIZE_PX
  while (s < MIN_GRID_SPACING_PX) s *= 2
  return s
})

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
const panelSide = computed(() =>
  panelPreset.value.endsWith('-dock')
    ? panelPreset.value.startsWith('left')
      ? 'left'
      : 'right'
    : panelPreset.value.endsWith('l')
      ? 'left'
      : 'right'
)
</script>

<template>
  <div
    class="layout-view"
    :data-panel-side="panelSide"
    :style="{
      '--viewport-scale': viewportScale,
      '--viewport-offset-x': `${viewportOffsetX}px`,
      '--viewport-offset-y': `${viewportOffsetY}px`,
      '--grid-spacing': `${gridSpacing}px`
    }"
  >
    <!-- Workspace layer: the viewport transform lives here, so the
         LinearPreview contents (welcome, image, arrange) zoom + pan
         together. Wheel + pointerdown handlers are attached to this
         wrapper; the chrome + panel are siblings (not descendants),
         so their events never trigger workspace navigation.
         The dot grid is painted on `.layout-view` (always viewport-
         sized) with dynamic background-size + background-position
         driven by the viewport vars above, so the grid pattern
         visually matches the transformed content without the
         element itself needing to be scaled. -->
    <div
      ref="bgRef"
      class="layout-view__background"
      :style="{ transform: workspaceTransform }"
      @wheel="handleWheel"
      @pointerdown="handlePointerDown"
      @dragstart.prevent
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
  /* Dot grid — stays on the viewport-sized element (never scales
     itself) but its background-size scales with `--viewport-scale`
     so the pattern visually matches the transformed content, and
     background-position shifts with `--viewport-offset-{x,y}` so it
     pans with the content. That way the grid always covers the
     viewport regardless of zoom level, and lines up with whatever
     LinearPreview is rendering inside the transformed workspace. */
  background-image: radial-gradient(
    circle,
    var(--color-layout-grid-dot) 1px,
    transparent 1.5px
  );
  background-size: var(--grid-spacing, var(--spacing-layout-dot))
    var(--grid-spacing, var(--spacing-layout-dot));
  background-position: var(--viewport-offset-x, 0) var(--viewport-offset-y, 0);
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
