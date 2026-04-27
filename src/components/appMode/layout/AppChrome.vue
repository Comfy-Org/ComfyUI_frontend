<script setup lang="ts">
/**
 * AppChrome — the chrome rail (mode toggle, feedback, run cluster, share)
 * shared by App Mode and App Builder.
 *
 * Architecture: four flex zones pinned to the viewport corners. Each
 * zone lays its cells out with fixed gutters using the layout tokens —
 * `calc(span * --spacing-layout-cell + (span - 1) * --spacing-layout-gutter)`
 * for width, so every cell aligns to the same grid math FloatingPanel
 * uses (`--panel-dock-width` is composed from the same tokens). No
 * distributed-gap CSS Grid — a cell in any zone and the dock panel snap
 * to identical pixel positions at every viewport.
 *
 * Zones:
 * - `top-left`  — mode toggle, builder icon. Pinned to top-left outer margin.
 * - `top-right` — share, batch count, job queue, run cluster. Right edge
 *                 is flush with the dock panel's right edge, so the
 *                 cluster's left edge lines up with the panel's left.
 * - `bottom-left` — feedback.
 * - `bottom-right` — workspace zoom cluster.
 *
 * Run-related output UX (history, rerun, reuse-params, download,
 * progress, interrupt) lives inside the OutputWindow surface in the
 * workspace, not in the chrome — see `OutputWindowList.vue`. The
 * thumbnail history strip + selection-driven action cells were
 * removed when the multi-window output workspace landed.
 *
 * Variant behavior: both variants emit the same cell logic. The
 * `HIDE_IN_BUILDER` set drops contextually-wrong cells (mode toggle,
 * builder icon) and `DISABLE_IN_BUILDER` tags cells that render but are
 * inert (Run, BatchCount — you can't execute a workflow from the
 * builder). Adding a new chrome cell in App Mode automatically surfaces
 * in the builder too; keep them in sync by construction.
 */
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import BatchCountCell from './cells/BatchCountCell.vue'
import FeedbackCell from './cells/FeedbackCell.vue'
import IconCell from './cells/IconCell.vue'
import JobQueueCell from './cells/JobQueueCell.vue'
import ModeToggleCell from './cells/ModeToggleCell.vue'
import RunCell from './cells/RunCell.vue'

import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import {
  openShareDialog,
  prefetchShareDialog
} from '@/platform/workflow/sharing/composables/lazyShareDialog'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueStore } from '@/stores/queueStore'

type ChromeCellKind =
  | 'system-mode-toggle'
  | 'system-builder'
  | 'system-share'
  | 'system-feedback'
  | 'system-batch-count'
  | 'system-job-queue'
  | 'system-run'
  | 'nav-zoom-in'
  | 'nav-zoom-out'
  | 'nav-zoom-percent'
  | 'nav-zoom-fit'

interface ChromeCell {
  id: string
  kind: ChromeCellKind
  /** Cell count this item spans horizontally. Width =
   *  span × cell + (span - 1) × gutter. */
  span: number
  /** Visual inert state — used by the builder variant to tag cells that
   *  render identically to App Mode but can't be interacted with. */
  disabled?: boolean
}

type AppChromeVariant = 'app-mode' | 'builder'

const { variant = 'app-mode' } = defineProps<{
  variant?: AppChromeVariant
}>()

const { t } = useI18n()
const { enableAppBuilder, isArrangeMode } = useAppMode()
const appModeStore = useAppModeStore()
const { enterBuilder, zoomIn, zoomOut, resetView } = appModeStore
const { hasNodes, viewportScale } = storeToRefs(appModeStore)

const canvasStore = useCanvasStore()
const { appScalePercentage } = storeToRefs(canvasStore)
const commandStore = useCommandStore()
const { toastErrorHandler } = useErrorHandling()

// In builder variant the cluster's percent readout reads
// `appScalePercentage`, which is only kept in sync while something
// has registered `canvasStore.initScaleSync()` (it wraps
// `LGraphCanvas.ds.onChanged` to mirror the live scale into the
// store). GraphCanvasMenu does this for the graph view; in builder
// that menu isn't mounted, so we register from here instead.
// Cleanup mirrors GraphCanvasMenu's so a graph→builder→graph swap
// doesn't pile multiple wrappers on `ds.onChanged`.
if (variant === 'builder') {
  onMounted(() => canvasStore.initScaleSync())
  onBeforeUnmount(() => canvasStore.cleanupScaleSync())
}

// Two zoom systems share one cluster:
// - App Mode (and builder's arrange step, which renders the App Mode
//   preview backdrop) drives `appModeStore.viewportScale` — the CSS
//   transform on the workspace wrapper.
// - Builder's inputs / outputs steps drive `LGraphCanvas.ds.scale`
//   via the existing `Comfy.Canvas.*` commands;
//   `canvasStore.appScalePercentage` is the integer-rounded read-back
//   of that scale.
// `isArrangeMode` flips builder-variant handlers over to the App
// Mode side so the cluster operates whatever surface the user is
// actually looking at (the graph canvas in inputs/outputs, the
// preview backdrop in arrange). Keeps the visual cluster consistent
// across phases — important for the builder→app-mode transition in
// the demo video.
const useAppModeZoom = computed(
  () => variant !== 'builder' || isArrangeMode.value
)

const zoomPercent = computed(() =>
  useAppModeZoom.value
    ? `${Math.round(viewportScale.value * 100)}%`
    : `${appScalePercentage.value}%`
)

function dispatchCanvas(commandId: string) {
  commandStore.execute(commandId).catch(toastErrorHandler)
}

const navZoomIn = () => {
  if (useAppModeZoom.value) return zoomIn()
  dispatchCanvas('Comfy.Canvas.ZoomIn')
}
const navZoomOut = () => {
  if (useAppModeZoom.value) return zoomOut()
  dispatchCanvas('Comfy.Canvas.ZoomOut')
}
const navResetView = () => {
  if (useAppModeZoom.value) return resetView()
  dispatchCanvas('Comfy.Canvas.FitView')
}
const { flags } = useFeatureFlags()

const showShare = computed(() => isCloud && flags.workflowSharingEnabled)

const queueStore = useQueueStore()
const { activeJobsCount } = storeToRefs(queueStore)
const showJobQueue = computed(() => activeJobsCount.value > 0)

function openShare() {
  openShareDialog().catch(toastErrorHandler)
}

// --- Variant-specific overrides -----------------------------------------
const HIDE_IN_BUILDER = new Set<ChromeCellKind>([
  'system-mode-toggle',
  'system-builder'
])

const DISABLE_IN_BUILDER = new Set<ChromeCellKind>([
  'system-batch-count',
  'system-run'
])

function include(out: ChromeCell[], cell: ChromeCell) {
  if (variant === 'builder' && HIDE_IN_BUILDER.has(cell.kind)) return
  if (variant === 'builder' && DISABLE_IN_BUILDER.has(cell.kind)) {
    out.push({ ...cell, disabled: true })
    return
  }
  out.push(cell)
}

// --- Zone cell lists ----------------------------------------------------

const topLeftCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  include(out, { id: 'mode-toggle', kind: 'system-mode-toggle', span: 2 })
  if (enableAppBuilder.value) {
    include(out, { id: 'builder', kind: 'system-builder', span: 1 })
  }
  return out
})

const topRightCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  // Job-queue first so its conditional presence pushes the cluster's
  // left edge instead of inserting between always-on cells (the
  // cluster is right-justified, so leftmost adds/removes don't move
  // share / batch / run visually).
  if (showJobQueue.value)
    include(out, { id: 'system-job-queue', kind: 'system-job-queue', span: 2 })
  if (showShare.value)
    include(out, { id: 'share', kind: 'system-share', span: 2 })
  include(out, {
    id: 'system-batch-count',
    kind: 'system-batch-count',
    span: 5
  })
  include(out, { id: 'system-run', kind: 'system-run', span: 2 })
  return out
})

const bottomLeftCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  include(out, { id: 'feedback', kind: 'system-feedback', span: 4 })
  return out
})

// Bottom-right nav cluster — renders in both variants. The handlers
// branch on `variant` (App Mode drives the workspace transform;
// builder dispatches `Comfy.Canvas.*` commands at the LGraphCanvas),
// so the cluster stays visually consistent across the
// builder ↔ app-mode transition.
const bottomRightCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  include(out, { id: 'nav-zoom-out', kind: 'nav-zoom-out', span: 1 })
  include(out, { id: 'nav-zoom-percent', kind: 'nav-zoom-percent', span: 2 })
  include(out, { id: 'nav-zoom-in', kind: 'nav-zoom-in', span: 1 })
  include(out, { id: 'nav-zoom-fit', kind: 'nav-zoom-fit', span: 1 })
  return out
})

// --- Helpers ------------------------------------------------------------
function cellWidth(span: number): string {
  return `calc(${span} * var(--spacing-layout-cell) + ${span - 1} * var(--spacing-layout-gutter))`
}

function cellTitle(cell: ChromeCell): string | undefined {
  if (cell.disabled) return t('linearMode.builder.runDisabledHint')
  return undefined
}

// Shared base for the three corner zones. Each zone adds its own
// top/left/right/bottom offset in the template.
const ZONE_BASE =
  'pointer-events-none absolute flex h-layout-cell flex-row gap-layout-gutter'

// Run cell hosts a full-bleed colored button directly — it doesn't
// want the cell's hairline border or layout-cell fill so the accent
// paint reaches the cell edges cleanly.
function cellClass(cell: ChromeCell): string {
  const bare = cell.kind === 'system-run'
  return cn(
    'pointer-events-auto flex h-full overflow-hidden',
    !bare && 'rounded-[10px] border border-white/8 bg-layout-cell',
    cell.disabled && 'cursor-not-allowed select-none'
  )
}
</script>

<template>
  <!-- Positioning host. `app-mode` variant anchors absolute-inset to its
       positioned LayoutView ancestor. `builder` variant has no such
       ancestor, so it bolts to the viewport (fixed) below the workflow
       tabs, under FloatingPanel (z-100) and any drag preview. Classname
       `app-chrome` is kept as an external CSS hook (LayoutView reads
       it via :deep()). -->
  <div
    :class="
      cn(
        'app-chrome pointer-events-none absolute inset-0 z-1',
        variant === 'builder' && [
          'fixed top-(--workflow-tabs-height) right-0 bottom-0',
          'left-(--sidebar-width,0px) z-90 cursor-not-allowed'
        ]
      )
    "
    :data-variant="variant"
  >
    <div
      :class="[
        ZONE_BASE,
        'top-(--spacing-layout-outer) left-(--spacing-layout-outer)'
      ]"
    >
      <div
        v-for="cell in topLeftCells"
        :key="cell.id"
        :class="cellClass(cell)"
        :inert="cell.disabled || undefined"
        :title="cellTitle(cell)"
        :style="{ width: cellWidth(cell.span) }"
        :data-cell-kind="cell.kind"
      >
        <IconCell
          v-if="cell.kind === 'system-builder'"
          icon="icon-[lucide--hammer]"
          :label="t('linearMode.appModeToolbar.appBuilder')"
          :disabled="!hasNodes"
          :on-activate="enterBuilder"
        />
        <ModeToggleCell v-else-if="cell.kind === 'system-mode-toggle'" />
      </div>
    </div>

    <div
      :class="[
        ZONE_BASE,
        'top-(--spacing-layout-outer) right-(--spacing-layout-outer)'
      ]"
    >
      <div
        v-for="cell in topRightCells"
        :key="cell.id"
        :class="cellClass(cell)"
        :inert="cell.disabled || undefined"
        :title="cellTitle(cell)"
        :style="{ width: cellWidth(cell.span) }"
        :data-cell-kind="cell.kind"
      >
        <IconCell
          v-if="cell.kind === 'system-share'"
          icon="icon-[lucide--send]"
          :label="t('actionbar.share')"
          inline-label
          :on-activate="openShare"
          @pointerenter="prefetchShareDialog"
        />
        <BatchCountCell v-else-if="cell.kind === 'system-batch-count'" />
        <JobQueueCell v-else-if="cell.kind === 'system-job-queue'" />
        <RunCell v-else-if="cell.kind === 'system-run'" />
      </div>
    </div>

    <div
      :class="[
        ZONE_BASE,
        'bottom-(--spacing-layout-outer) left-(--spacing-layout-outer)'
      ]"
    >
      <div
        v-for="cell in bottomLeftCells"
        :key="cell.id"
        :class="cellClass(cell)"
        :inert="cell.disabled || undefined"
        :title="cellTitle(cell)"
        :style="{ width: cellWidth(cell.span) }"
        :data-cell-kind="cell.kind"
      >
        <FeedbackCell v-if="cell.kind === 'system-feedback'" />
      </div>
    </div>

    <div
      :class="[
        ZONE_BASE,
        'right-(--spacing-layout-outer) bottom-(--spacing-layout-outer)'
      ]"
    >
      <div
        v-for="cell in bottomRightCells"
        :key="cell.id"
        :class="cellClass(cell)"
        :inert="cell.disabled || undefined"
        :title="cellTitle(cell)"
        :style="{ width: cellWidth(cell.span) }"
        :data-cell-kind="cell.kind"
      >
        <IconCell
          v-if="cell.kind === 'nav-zoom-out'"
          icon="icon-[lucide--zoom-out]"
          :label="t('linearMode.zoomOut')"
          :on-activate="navZoomOut"
        />
        <div
          v-else-if="cell.kind === 'nav-zoom-percent'"
          :class="[
            'flex size-full items-center justify-center',
            'font-inter text-layout-md text-layout-text tabular-nums',
            'cursor-default select-none'
          ]"
        >
          {{ zoomPercent }}
        </div>
        <IconCell
          v-else-if="cell.kind === 'nav-zoom-in'"
          icon="icon-[lucide--zoom-in]"
          :label="t('linearMode.zoomIn')"
          :on-activate="navZoomIn"
        />
        <IconCell
          v-else-if="cell.kind === 'nav-zoom-fit'"
          icon="icon-[lucide--maximize]"
          :label="t('linearMode.resetView')"
          :on-activate="navResetView"
        />
      </div>
    </div>
  </div>
</template>
