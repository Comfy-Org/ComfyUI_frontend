<script setup lang="ts">
/**
 * AppChrome — the chrome rail (mode toggle, feedback, run cluster, share,
 * action cells, history thumbs) shared by App Mode and App Builder.
 *
 * Architecture: three flex zones pinned to the viewport corners. Each
 * zone lays its cells out with fixed gutters using the layout tokens —
 * `calc(span * --spacing-layout-cell + (span - 1) * --spacing-layout-gutter)`
 * for width, so every cell aligns to the same grid math FloatingPanel
 * uses (`--panel-dock-width` is composed from the same tokens). No
 * distributed-gap CSS Grid — a cell in any zone and the dock panel snap
 * to identical pixel positions at every viewport.
 *
 * Zones:
 * - `top-left`  — mode toggle, builder icon, optional action cells,
 *                 optional history thumbs. Pinned to top-left outer margin.
 * - `top-right` — share, batch count, job queue, run cluster. Right edge
 *                 is flush with the dock panel's right edge, so the
 *                 cluster's left edge lines up with the panel's left.
 * - `bottom-left` — feedback.
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BatchCountCell from './cells/BatchCountCell.vue'
import FeedbackCell from './cells/FeedbackCell.vue'
import IconCell from './cells/IconCell.vue'
import InterruptCell from './cells/InterruptCell.vue'
import JobQueueCell from './cells/JobQueueCell.vue'
import ModeToggleCell from './cells/ModeToggleCell.vue'
import OutputThumbCell from './cells/OutputThumbCell.vue'
import ProgressCell from './cells/ProgressCell.vue'
import RunCell from './cells/RunCell.vue'

import { downloadFile } from '@/base/common/downloadUtil'
import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { isCloud } from '@/platform/distribution/types'
import {
  openShareDialog,
  prefetchShareDialog
} from '@/platform/workflow/sharing/composables/lazyShareDialog'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueStore } from '@/stores/queueStore'
import type { ResultItemImpl } from '@/stores/queueStore'

type ChromeCellKind =
  | 'system-mode-toggle'
  | 'system-builder'
  | 'system-share'
  | 'system-feedback'
  | 'system-batch-count'
  | 'system-job-queue'
  | 'system-interrupt'
  | 'system-progress'
  | 'system-run'
  | 'action-rerun'
  | 'action-reuse-params'
  | 'action-download'
  | 'action-info'
  | 'output-thumb'
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

// --- Output history (thumbnails + action-cell selection) ----------------
// Must be called once per mount. `fetchMediaList()` runs as a side effect
// so don't invoke this inside a computed.
const outputHistory = useOutputHistory()
const { outputs, allOutputs } = outputHistory

const linearOutputStore = useLinearOutputStore()
const { selectedId } = storeToRefs(linearOutputStore)

const selectedHistory = computed<{
  asset: AssetItem
  output: ResultItemImpl
} | null>(() => {
  const id = selectedId.value
  if (!id || !id.startsWith('history:')) return null
  const afterPrefix = id.substring('history:'.length)
  const lastColon = afterPrefix.lastIndexOf(':')
  if (lastColon === -1) return null
  const assetId = afterPrefix.substring(0, lastColon)
  const outputIndex = Number.parseInt(afterPrefix.substring(lastColon + 1), 10)
  if (!assetId || !Number.isInteger(outputIndex) || outputIndex < 0) return null
  const asset = outputs.media.value.find((a) => a.id === assetId)
  if (!asset) return null
  const output = allOutputs(asset)[outputIndex]
  if (!output) return null
  return { asset, output }
})

const hasSelection = computed(() => selectedHistory.value !== null)

async function loadSelectedWorkflow() {
  const sel = selectedHistory.value
  if (!sel) return
  const { workflow } = await extractWorkflowFromAsset(sel.asset)
  if (!workflow) return
  // `app.rootGraph` may be null mid-transition (e.g. during a workflow
  // swap). Treat "no current graph" as "not the same graph" — fall
  // through to loadGraphData so we end up with the selected workflow
  // loaded either way.
  if (workflow.id !== app.rootGraph?.id) {
    await app.loadGraphData(workflow)
    return
  }
  const changeTracker = useWorkflowStore().activeWorkflow?.changeTracker
  if (!changeTracker) {
    await app.loadGraphData(workflow)
    return
  }
  changeTracker.redoQueue = []
  await changeTracker.updateState([workflow], changeTracker.undoQueue)
}

async function actionRerun() {
  await loadSelectedWorkflow()
  try {
    await commandStore.execute('Comfy.QueuePrompt', {
      metadata: { subscribe_to_run: false, trigger_source: 'linear' }
    })
  } catch (error) {
    toastErrorHandler(error)
  }
}

function actionReuseParams() {
  loadSelectedWorkflow().catch(toastErrorHandler)
}

function actionDownload() {
  const url = selectedHistory.value?.output.url
  if (url) downloadFile(url)
}

const infoName = computed(() => {
  const sel = selectedHistory.value
  if (!sel) return ''
  return sel.output.display_name?.trim() || sel.output.filename || ''
})

// Track the loaded image's natural dimensions for the selected output.
const dimensions = ref<{ w: number; h: number } | null>(null)
watch(
  () => selectedHistory.value?.output.url,
  (url) => {
    dimensions.value = null
    if (!url) return
    const img = new Image()
    img.onload = () => {
      if (selectedHistory.value?.output.url !== url) return
      dimensions.value = { w: img.naturalWidth, h: img.naturalHeight }
    }
    img.onerror = () => {
      // Dimension-probe failures fall through to the non-dimensions
      // filename label — no surface-level error is needed because the
      // asset itself still renders via its main preview element. Silent
      // by design so a flaky image URL doesn't spam toasts on every
      // thumb switch.
    }
    img.src = url
  },
  { immediate: true }
)

const infoDims = computed(() =>
  dimensions.value ? `${dimensions.value.w}x${dimensions.value.h}` : ''
)
const infoLabel = computed(() => {
  const dotIdx = infoName.value.lastIndexOf('.')
  return dotIdx >= 0 ? infoName.value.slice(dotIdx + 1).toLowerCase() : ''
})
const infoTitle = computed(() =>
  [infoDims.value, infoName.value].filter(Boolean).join(' ')
)

// --- History thumbnails ----------------------------------------------
interface HistoryThumb {
  id: string
  asset: AssetItem
  output: ResultItemImpl
}

const historyThumbs = computed<HistoryThumb[]>(() =>
  outputs.media.value.flatMap((asset) => {
    const outs = allOutputs(asset)
    if (outs.length === 0) return []
    return [{ id: `thumb-${asset.id}`, asset, output: outs[0] }]
  })
)

const historyThumbMap = computed(
  () => new Map(historyThumbs.value.map((t) => [t.id, t]))
)

// --- Variant-specific overrides -----------------------------------------
const HIDE_IN_BUILDER = new Set<ChromeCellKind>([
  'system-mode-toggle',
  'system-builder'
])

const DISABLE_IN_BUILDER = new Set<ChromeCellKind>([
  'system-batch-count',
  'system-interrupt',
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
// Cap so a history-heavy workflow doesn't push thumbs past the top-right
// cluster on narrow viewports. Conservative for typical desktop widths.
const MAX_HISTORY_THUMBS = 6

const topLeftCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  include(out, { id: 'mode-toggle', kind: 'system-mode-toggle', span: 2 })
  if (enableAppBuilder.value) {
    include(out, { id: 'builder', kind: 'system-builder', span: 1 })
  }
  if (hasSelection.value) {
    include(out, { id: 'action-rerun', kind: 'action-rerun', span: 1 })
    include(out, {
      id: 'action-reuse-params',
      kind: 'action-reuse-params',
      span: 1
    })
    include(out, { id: 'action-download', kind: 'action-download', span: 1 })
    include(out, { id: 'action-info', kind: 'action-info', span: 4 })
  }
  const thumbCount = Math.min(historyThumbs.value.length, MAX_HISTORY_THUMBS)
  for (let i = 0; i < thumbCount; i++) {
    include(out, {
      id: historyThumbs.value[i].id,
      kind: 'output-thumb',
      span: 1
    })
  }
  return out
})

const topRightCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  // Progress bar sits leftmost in the cluster so it stays out of the
  // right-docked FloatingPanel's way and flanks Share / batch / run
  // without bumping the cluster's right edge when it appears.
  if (showJobQueue.value)
    include(out, { id: 'system-progress', kind: 'system-progress', span: 4 })
  if (showShare.value)
    include(out, { id: 'share', kind: 'system-share', span: 2 })
  include(out, {
    id: 'system-batch-count',
    kind: 'system-batch-count',
    span: 5
  })
  if (showJobQueue.value)
    include(out, { id: 'system-job-queue', kind: 'system-job-queue', span: 2 })
  if (showJobQueue.value)
    include(out, {
      id: 'system-interrupt',
      kind: 'system-interrupt',
      span: 1
    })
  include(out, { id: 'system-run', kind: 'system-run', span: 3 })
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
  if (cell.kind === 'action-info') return infoTitle.value
  return undefined
}

// Shared base for the three corner zones. Each zone adds its own
// top/left/right/bottom offset in the template.
const ZONE_BASE =
  'pointer-events-none absolute flex h-layout-cell flex-row gap-layout-gutter'

// Placeholder go/stop fill colors for the run cluster (RunCell,
// InterruptCell, ProgressCell). Set on the chrome root so descendants
// read them via `var(--app-mode-*)`. Kept local here so the rest of
// the app's design-system tokens stay untouched — pending a
// product/design decision on whether "go green" + "stop red" get
// promoted to proper semantic tokens (--color-success-*, etc.). When
// that lands, swap the four call sites to the real tokens and delete
// this block.
const goStopVars = {
  '--app-mode-go-bg': '#16a34a', // tw green-600
  '--app-mode-go-bg-hover': '#22c55e', // tw green-500
  '--app-mode-go-border': '#166534', // tw green-800
  '--app-mode-stop-bg': '#ef4444', // tw red-500
  '--app-mode-stop-bg-hover': '#f87171', // tw red-400
  '--app-mode-stop-border': '#b91c1c' // tw red-700
} as const

// Run + Interrupt cells host full-bleed colored buttons directly —
// they don't want the cell's hairline border or layout-cell fill so
// the accent paint reaches the cell edges cleanly.
function cellClass(cell: ChromeCell): string {
  const bare = cell.kind === 'system-run' || cell.kind === 'system-interrupt'
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
    :style="goStopVars"
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
        <IconCell
          v-else-if="cell.kind === 'action-rerun'"
          icon="icon-[lucide--refresh-cw]"
          :label="t('linearMode.rerun')"
          :on-activate="actionRerun"
        />
        <IconCell
          v-else-if="cell.kind === 'action-reuse-params'"
          icon="icon-[lucide--list-restart]"
          :label="t('linearMode.reuseParameters')"
          :on-activate="actionReuseParams"
        />
        <IconCell
          v-else-if="cell.kind === 'action-download'"
          icon="icon-[lucide--download]"
          :label="t('g.download')"
          :on-activate="actionDownload"
        />
        <div
          v-else-if="cell.kind === 'action-info'"
          :class="[
            'duration-layout flex size-full cursor-default items-center justify-between',
            'rounded-layout-cell bg-layout-cell px-3',
            'font-inter text-layout-md text-layout-text',
            'transition-colors ease-layout hover:bg-layout-cell-hover'
          ]"
        >
          <!-- justify-between distributes the icon / bullet / dims /
               bullet / ext row evenly across the cell width; bullets
               read as separators rather than padding, and the row
               collapses gracefully if either dims or ext is empty. -->
          <i class="icon-[lucide--file] size-5 shrink-0" aria-hidden="true" />
          <span v-if="infoDims" class="shrink-0 opacity-50" aria-hidden="true"
            >•</span
          >
          <span
            v-if="infoDims"
            class="shrink-0 text-layout-text tabular-nums"
            >{{ infoDims }}</span
          >
          <span v-if="infoLabel" class="shrink-0 opacity-50" aria-hidden="true"
            >•</span
          >
          <span
            v-if="infoLabel"
            class="shrink-0 tracking-[0.02em] tabular-nums"
            >{{ infoLabel }}</span
          >
        </div>
        <OutputThumbCell
          v-else-if="
            cell.kind === 'output-thumb' && historyThumbMap.get(cell.id)
          "
          :asset="historyThumbMap.get(cell.id)!.asset"
          :output="historyThumbMap.get(cell.id)!.output"
        />
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
        <InterruptCell v-else-if="cell.kind === 'system-interrupt'" />
        <ProgressCell v-else-if="cell.kind === 'system-progress'" />
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
