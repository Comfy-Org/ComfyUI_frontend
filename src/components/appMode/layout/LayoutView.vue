<script setup lang="ts">
/**
 * LayoutView — App Mode runtime view.
 *
 * Solution 04 (Phase 4-A): LinearPreview is the full-viewport background;
 * system chrome (mode toggle, feedback, utility icons) floats in the
 * layout grid above it; a single right-dock FloatingPanel overlays inputs
 * + run on the right side. Drag, resize, persistence, and multi-panel
 * land in later phases (4-B through 4-I).
 */
import { useEventListener } from '@vueuse/core'
import { computed, ref, shallowRef, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

import LayoutGrid from './LayoutGrid.vue'
import type { LayoutCellPlacement } from './LayoutGrid.vue'
import IconCell from './cells/IconCell.vue'
import FeedbackCell from './cells/FeedbackCell.vue'
import ModeToggleCell from './cells/ModeToggleCell.vue'
import type { InputCellEntry } from './cells/InputCell.vue'
import OutputThumbCell from './cells/OutputThumbCell.vue'
import BatchCountCell from './cells/BatchCountCell.vue'
import JobQueueCell from './cells/JobQueueCell.vue'
import RunCell from './cells/RunCell.vue'
import FloatingPanel from './panels/FloatingPanel.vue'
import PanelBlockList from './panels/PanelBlockList.vue'
import type {
  BlockConfig,
  BlockPos,
  BlockRow,
  DropTarget
} from './panels/panelTypes'

import LinearPreview from '@/renderer/extensions/linearMode/LinearPreview.vue'
import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { downloadFile } from '@/base/common/downloadUtil'
import { getPathDetails } from '@/utils/formatUtil'
import type { ResultItemImpl } from '@/stores/queueStore'
import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useQueueStore } from '@/stores/queueStore'
import { isCloud } from '@/platform/distribution/types'
import {
  openShareDialog,
  prefetchShareDialog
} from '@/platform/workflow/sharing/composables/lazyShareDialog'
import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { app } from '@/scripts/app'
import { resolveNodeWidget } from '@/utils/litegraphUtil'

const { t } = useI18n()
const { enableAppBuilder } = useAppMode()
const appModeStore = useAppModeStore()
const { enterBuilder } = appModeStore
const { hasNodes } = storeToRefs(appModeStore)
const commandStore = useCommandStore()
const workflowStore = useWorkflowStore()
const { toastErrorHandler } = useErrorHandling()
const { flags } = useFeatureFlags()

const showShare = computed(() => isCloud && flags.workflowSharingEnabled)

// Drives the inline "N active" cell in the top-right cluster — mirrors
// the graph-view job-queue button. Only renders when there are jobs
// queued or running so the cluster stays compact while idle.
const queueStore = useQueueStore()
const { activeJobsCount } = storeToRefs(queueStore)
const showJobQueue = computed(() => activeJobsCount.value > 0)

function openShare() {
  openShareDialog().catch(toastErrorHandler)
}

// --- Per-input entry data (unchanged from Phase 2a) ---------------------

const graphNodes = shallowRef<LGraphNode[]>(app.rootGraph.nodes)
useEventListener(
  app.rootGraph.events,
  'configured',
  () => (graphNodes.value = app.rootGraph.nodes)
)

interface InputEntryWithMeta extends InputCellEntry {
  isMultiline: boolean
}

const inputEntries = computed<InputEntryWithMeta[]>(() => {
  void graphNodes.value
  const nodeDataByNode = new Map<
    LGraphNode,
    ReturnType<typeof extractVueNodeData>
  >()

  return appModeStore.selectedInputs.flatMap(([nodeId, widgetName]) => {
    const [node, widget] = resolveNodeWidget(nodeId, widgetName)
    if (!widget || !node || node.mode !== LGraphEventMode.ALWAYS) return []

    if (!nodeDataByNode.has(node)) {
      nodeDataByNode.set(node, extractVueNodeData(node))
    }
    const fullNodeData = nodeDataByNode.get(node)!

    const matchingWidget = fullNodeData.widgets?.find((vueWidget) => {
      if (vueWidget.slotMetadata?.linked) return false
      if (!node.isSubgraphNode()) return vueWidget.name === widget.name
      const storeNodeId = vueWidget.storeNodeId?.split(':')?.[1] ?? ''
      return (
        isPromotedWidgetView(widget) &&
        widget.sourceNodeId == storeNodeId &&
        widget.sourceWidgetName === vueWidget.storeName
      )
    })
    if (!matchingWidget) return []

    matchingWidget.slotMetadata = undefined
    matchingWidget.nodeId = String(node.id)

    const isMultiline =
      Boolean(
        (widget.options as { multiline?: boolean } | undefined)?.multiline
      ) || String(widget.type).toLowerCase() === 'customtext'

    return [
      {
        key: `${nodeId}:${widgetName}`,
        nodeData: {
          ...fullNodeData,
          widgets: [matchingWidget]
        },
        widget,
        node,
        isMultiline
      }
    ]
  })
})

const inputEntryMap = computed(
  () => new Map(inputEntries.value.map((e) => [e.key, e]))
)

// --- Phase 4-A: hard-coded single panel + 4-C drag state ----------------
// Phase 4-B will move preset + blocks into the store and persist them.
const panelTitle = computed(() => {
  const path = workflowStore.activeWorkflow?.path
  if (!path) return ''
  return getPathDetails(path).filename
})

// Panel preset + collapse state live in appModeStore so App Mode + App
// Builder share them; moving or collapsing in either updates both.
const { panelPreset, panelCollapsed } = storeToRefs(appModeStore)

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

// Block list is a 2D grid (rows of columns) so 4-E (reorder) and 4-F
// (multi-column) can both mutate it. Reconciliation preserves user
// rows/columns across input changes.
const panelRows = ref<BlockRow[]>([])

watchEffect(() => {
  const desiredInputIds = new Set(
    inputEntries.value.map((e) => `input-${e.key}`)
  )
  const entryByBlockId = new Map(
    inputEntries.value.map((e) => [`input-${e.key}`, e])
  )
  const existingInputIds = new Set<string>()
  for (const row of panelRows.value) {
    for (const b of row) {
      if (b.kind === 'input') existingInputIds.add(b.id)
    }
  }

  // Preserve rows; drop blocks whose input entry is gone; refresh meta.
  const preserved: BlockRow[] = panelRows.value
    .map(
      (row): BlockRow =>
        row.flatMap((block): BlockConfig[] => {
          if (block.kind === 'input') {
            if (!desiredInputIds.has(block.id)) return []
            const entry = entryByBlockId.get(block.id)!
            return [
              {
                ...block,
                entryKey: entry.key,
                isMultiline: entry.isMultiline
              }
            ]
          }
          return [block]
        })
    )
    .filter((row) => row.length > 0)

  // Append brand-new inputs as single-block rows at the end.
  for (const entry of inputEntries.value) {
    const id = `input-${entry.key}`
    if (existingInputIds.has(id)) continue
    preserved.push([
      {
        id,
        kind: 'input',
        entryKey: entry.key,
        isMultiline: entry.isMultiline
      }
    ])
  }

  panelRows.value = preserved
})

function moveBlock(from: BlockPos, target: DropTarget) {
  // Work on a fresh copy so Vue sees a new top-level value.
  const rows: BlockRow[] = panelRows.value.map((r) => r.slice())
  if (!rows[from.row] || rows[from.row][from.col] === undefined) return
  const moved = rows[from.row][from.col]

  // --- Noop detection on pre-removal grid ----------------------------
  const sourceRowLen = rows[from.row].length
  const isSoloRow = sourceRowLen === 1

  if (
    (target.kind === 'columnBefore' &&
      target.rowIndex === from.row &&
      target.colIndex === from.col) ||
    (target.kind === 'columnAfter' &&
      target.rowIndex === from.row &&
      target.colIndex === from.col)
  ) {
    return
  }
  if (
    isSoloRow &&
    (target.kind === 'newRowBefore' || target.kind === 'newRowAfter') &&
    target.rowIndex === from.row
  ) {
    return
  }

  // --- Remove from source --------------------------------------------
  rows[from.row].splice(from.col, 1)
  const sourceRowRemoved = rows[from.row].length === 0
  if (sourceRowRemoved) rows.splice(from.row, 1)

  // --- Insert at destination -----------------------------------------
  const shiftForRemovedRow = (idx: number) =>
    sourceRowRemoved && from.row < idx ? idx - 1 : idx

  if (target.kind === 'newRowBefore' || target.kind === 'newRowAfter') {
    const base =
      target.kind === 'newRowAfter' ? target.rowIndex + 1 : target.rowIndex
    const destRow = shiftForRemovedRow(base)
    rows.splice(destRow, 0, [moved])
  } else {
    const destRow = shiftForRemovedRow(target.rowIndex)
    const row = rows[destRow]
    if (!row) return
    let destCol = target.colIndex
    // Same-row compaction: if we removed a block to the left of the
    // target column within the same row, shift the target col left.
    if (
      !sourceRowRemoved &&
      from.row === target.rowIndex &&
      from.col < destCol
    ) {
      destCol -= 1
    }
    if (target.kind === 'columnAfter') destCol += 1
    destCol = Math.max(0, Math.min(row.length, destCol))
    row.splice(destCol, 0, moved)
  }

  panelRows.value = rows
}

// --- Output history (shared for thumbnails + action cells) -------------
// IMPORTANT: call useOutputHistory() exactly once. Its constructor runs
// `fetchMediaList()` as a side effect — invoking it inside a computed
// creates a feedback loop where the computed's re-evaluation re-fetches,
// which changes the media list, which re-runs the computed, causing
// the main canvas to flash between selected and welcome states.
const outputHistory = useOutputHistory()
const { outputs, allOutputs } = outputHistory

// --- Selection-driven action cells --------------------------------------
// Mirrors LinearPreview's top action bar (rerun / reuse params / download)
// placed as grid icon cells on row 1, right of the mode toggle. Resolves
// the current selection from the shared linearOutputStore.
const linearOutputStore = useLinearOutputStore()
const { selectedId } = storeToRefs(linearOutputStore)

// Action cells only make sense for history selections, not active slots.
const selectedHistory = computed<{
  asset: AssetItem
  output: ResultItemImpl
} | null>(() => {
  const id = selectedId.value
  if (!id || !id.startsWith('history:')) return null
  const [, assetIdStr, kStr] = id.split(':')
  const assetId = assetIdStr
  const outputIndex = Number(kStr)
  if (!assetId || Number.isNaN(outputIndex)) return null
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
  if (workflow.id !== app.rootGraph.id) {
    app.loadGraphData(workflow)
    return
  }
  const changeTracker = useWorkflowStore().activeWorkflow?.changeTracker
  if (!changeTracker) {
    app.loadGraphData(workflow)
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
    console.error('[LayoutView] rerun failed:', error)
  }
}

function actionReuseParams() {
  void loadSelectedWorkflow()
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
// Mirrors ImagePreview's onImageLoad logic so we can surface WxH in the
// layout info cell without relying on LinearPreview's hidden overlay.
const dimensions = ref<{ w: number; h: number } | null>(null)
watch(
  () => selectedHistory.value?.output.url,
  (url) => {
    dimensions.value = null
    if (!url) return
    const img = new Image()
    img.onload = () => {
      // Guard against race: if the URL changed before load, skip.
      if (selectedHistory.value?.output.url !== url) return
      dimensions.value = { w: img.naturalWidth, h: img.naturalHeight }
    }
    img.src = url
  },
  { immediate: true }
)

const infoDims = computed(() =>
  dimensions.value ? `${dimensions.value.w}x${dimensions.value.h}` : ''
)
// Show only the file extension in the cell (e.g. "png"); full filename
// stays in the tooltip/aria-label so nothing is lost.
const infoLabel = computed(() => {
  const dotIdx = infoName.value.lastIndexOf('.')
  return dotIdx >= 0 ? infoName.value.slice(dotIdx + 1).toLowerCase() : ''
})
const infoTitle = computed(() =>
  [infoDims.value, infoName.value].filter(Boolean).join(' ')
)

// --- Output history thumbnails -----------------------------------------
// Replaces LinearPreview's horizontal history strip (hidden via the
// hide-chrome prop below). Thumbnails stack down column 1 starting from
// just below the icon stack. Max caps at MAX_HISTORY_THUMBS for now;
// snake-around-feedback can follow later.
const MAX_HISTORY_THUMBS = 10

interface HistoryThumb {
  id: string
  asset: AssetItem
  output: ResultItemImpl
}

const historyThumbs = computed<HistoryThumb[]>(() =>
  outputs.media.value
    .flatMap((asset) => {
      const outs = allOutputs(asset)
      if (outs.length === 0) return []
      return [{ id: `thumb-${asset.id}`, asset, output: outs[0] }]
    })
    .slice(0, MAX_HISTORY_THUMBS)
)

const historyThumbMap = computed(
  () => new Map(historyThumbs.value.map((t) => [t.id, t]))
)

// --- Chrome cells only (mode toggle, feedback, utility column) ----------
const cells = computed<LayoutCellPlacement[]>(() => {
  const out: LayoutCellPlacement[] = []

  // Row 1, left side (left-to-right): App/Graph mode toggle, then optional
  // builder. Toggle is anchored at col 1 so it doesn't shift when builder
  // visibility changes. Share moved to the right-side group to mirror the
  // graph-view top-right composition (Run + queue + share cluster there).
  out.push({
    id: 'mode-toggle',
    col: 1,
    row: 1,
    colSpan: 2,
    kind: 'system-mode-toggle'
  })
  let col = 3
  if (enableAppBuilder.value) {
    out.push({ id: 'builder', col: col++, row: 1, kind: 'system-builder' })
  }

  // Action cells on row 1, right of builder. Only mount when a history
  // item is selected (mirrors LinearPreview's top bar).
  if (hasSelection.value) {
    out.push({ id: 'action-rerun', col: col++, row: 1, kind: 'action-rerun' })
    out.push({
      id: 'action-reuse-params',
      col: col++,
      row: 1,
      kind: 'action-reuse-params'
    })
    out.push({
      id: 'action-download',
      col: col++,
      row: 1,
      kind: 'action-download'
    })
    out.push({
      id: 'action-info',
      col,
      row: 1,
      colSpan: 3,
      kind: 'action-info'
    })
    col += 3
  }

  out.push({
    id: 'feedback',
    col: 1,
    row: -2,
    colSpan: 4,
    kind: 'system-feedback'
  })

  // Row 1, right side (right-to-left): Run button anchored at the right
  // edge, "Number of runs" scrubber just to its left, Share (when
  // available, labeled) on the far left of the cluster.
  //
  // Negative col + span anchors via CSS Grid's end-aligned line numbers:
  // line -1 is the rightmost line (N+1 for N tracks), so a cell whose
  // end line is -1 must start at `-1 - span` (e.g. rightmost 3 tracks =
  // col: -4, colSpan: 3). Using -3 would overflow into an implicit
  // track past the outer padding.
  out.push({
    id: 'system-run',
    col: -4,
    colSpan: 3,
    row: 1,
    kind: 'system-run'
  })
  // When jobs are queued/running, insert a 2-track queue indicator
  // between BatchCount and Run — shifts BatchCount + Share left by 2.
  if (showJobQueue.value) {
    out.push({
      id: 'system-job-queue',
      col: -6,
      colSpan: 2,
      row: 1,
      kind: 'system-job-queue'
    })
  }
  const batchShift = showJobQueue.value ? -2 : 0
  out.push({
    id: 'system-batch-count',
    col: -9 + batchShift,
    colSpan: 5,
    row: 1,
    kind: 'system-batch-count'
  })
  if (showShare.value) {
    out.push({
      id: 'share',
      col: -11 + batchShift,
      colSpan: 2,
      row: 1,
      kind: 'system-share'
    })
  }

  // History thumbs sit on row 1, right of the action cells. Keeps column 1
  // clear so the left-dock panel snaps flush against the SideToolbar.
  for (let i = 0; i < historyThumbs.value.length; i++) {
    out.push({
      id: historyThumbs.value[i].id,
      col: col + i,
      row: 1,
      kind: 'output-thumb'
    })
  }

  return out
})
</script>

<template>
  <div class="layout-view" :data-panel-side="panelSide">
    <!-- Background layer: output canvas fills the viewport. LinearPreview's
         built-in chrome (top actions + bottom history/feedback) is hidden;
         we render replacements as layout cells. -->
    <div class="layout-view__background">
      <LinearPreview hide-chrome />
    </div>

    <!-- Chrome layer: floating utility cells sit above the background. -->
    <LayoutGrid :cells="cells">
      <template v-for="cell in cells" :key="cell.id" #[cell.id]>
        <IconCell
          v-if="cell.kind === 'system-builder'"
          icon="icon-[lucide--hammer]"
          :label="t('linearMode.appModeToolbar.appBuilder')"
          :disabled="!hasNodes"
          :on-activate="enterBuilder"
        />
        <IconCell
          v-else-if="cell.kind === 'system-share'"
          icon="icon-[lucide--send]"
          :label="t('actionbar.share')"
          inline-label
          :on-activate="openShare"
          @pointerenter="prefetchShareDialog"
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
        <button
          v-else-if="cell.kind === 'action-info'"
          type="button"
          class="info-cell"
          :title="infoTitle"
          :aria-label="infoTitle"
        >
          <i class="info-cell__icon icon-[lucide--file]" />
          <span v-if="infoDims" class="info-cell__dims">{{ infoDims }}</span>
          <span class="info-cell__label">{{ infoLabel }}</span>
        </button>
        <FeedbackCell v-else-if="cell.kind === 'system-feedback'" />
        <BatchCountCell v-else-if="cell.kind === 'system-batch-count'" />
        <JobQueueCell v-else-if="cell.kind === 'system-job-queue'" />
        <RunCell v-else-if="cell.kind === 'system-run'" />
        <OutputThumbCell
          v-else-if="
            cell.kind === 'output-thumb' && historyThumbMap.get(cell.id)
          "
          :asset="historyThumbMap.get(cell.id)!.asset"
          :output="historyThumbMap.get(cell.id)!.output"
        />
      </template>
    </LayoutGrid>

    <!-- Overlay layer: the floating panel(s). Phase 4-A: one panel;
         Phase 4-C: drag between presets. -->
    <FloatingPanel
      v-model:preset="panelPreset"
      v-model:collapsed="panelCollapsed"
      :title="panelTitle"
      movable
    >
      <PanelBlockList
        :rows="panelRows"
        :input-entry-map="inputEntryMap"
        :on-reorder="moveBlock"
      />
    </FloatingPanel>
  </div>
</template>

<!-- Design tokens are loaded globally via src/assets/css/style.css so the
     builder chrome can reuse them — no per-component import needed. -->

<style scoped>
.layout-view {
  position: absolute;
  inset: 0;
  background-color: var(--layout-color-canvas);
  /* Form-builder dot grid — decorative. Not aligned with LayoutGrid
     cell positions (the grid's gaps expand to absorb viewport slack,
     so cell corners drift relative to any fixed-pitch pattern). */
  background-image: radial-gradient(
    circle,
    var(--layout-color-grid-dot) 1px,
    transparent 1.5px
  );
  background-size: var(--layout-dot-grid-size) var(--layout-dot-grid-size);
  background-position: 0 0;
  /* Clip LinearPreview's inner absolute-positioned layers (image,
     skeletons, welcome) so they can never paint above the layout-view
     box — which sits below the top workflow-tabs bar. */
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
    var(--panel-dock-width, 420px) + var(--layout-outer-padding, 16px)
  );
}

.layout-view[data-panel-side='left'] {
  --welcome-panel-offset-left: calc(
    var(--panel-dock-width, 420px) + var(--layout-outer-padding, 16px)
  );
  --welcome-panel-offset-right: 0;
}

.layout-view__background {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

/* Lift the chrome grid above the background and make it transparent so
   LinearPreview shows through where there's no chrome cell. */
.layout-view :deep(.layout-grid) {
  z-index: 1;
  background-color: transparent;
  pointer-events: none;
}
.layout-view :deep(.layout-grid) > * {
  pointer-events: auto;
}

/* Panel-matched chrome: every system + action cell borrows
   FloatingPanel's surface styling (1px hairline border + 10px
   radius) so the whole App Mode chrome reads as one family. */
.layout-view :deep(.layout-cell[data-cell-kind='system-mode-toggle']),
.layout-view :deep(.layout-cell[data-cell-kind='system-builder']),
.layout-view :deep(.layout-cell[data-cell-kind='system-share']),
.layout-view :deep(.layout-cell[data-cell-kind='system-feedback']),
.layout-view :deep(.layout-cell[data-cell-kind='system-batch-count']),
.layout-view :deep(.layout-cell[data-cell-kind='system-job-queue']),
.layout-view :deep(.layout-cell[data-cell-kind='system-run']),
.layout-view :deep(.layout-cell[data-cell-kind='action-rerun']),
.layout-view :deep(.layout-cell[data-cell-kind='action-reuse-params']),
.layout-view :deep(.layout-cell[data-cell-kind='action-download']),
.layout-view :deep(.layout-cell[data-cell-kind='action-info']),
.layout-view :deep(.layout-cell[data-cell-kind='output-thumb']) {
  box-sizing: border-box;
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 10px;
  overflow: hidden;
}

/* Run cell hosts the accent-colored button directly — drop the chrome
   fill so only the button paints and the cell radius matches the
   button radius (8px inside 10px reads as a crisp pill). */
.layout-view :deep(.layout-cell[data-cell-kind='system-run']) {
  border: none;
  background-color: transparent;
}

.info-cell {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: none;
  border-radius: var(--layout-cell-radius);
  background-color: var(--layout-color-cell-fill);
  color: var(--layout-color-text);
  cursor: default;
  font-family: inherit;
  font-size: var(--layout-font-md);
  transition: background-color var(--layout-transition-duration)
    var(--layout-transition-easing);
}

.info-cell:hover {
  background-color: var(--layout-color-cell-hover);
}

.info-cell__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.info-cell__dims {
  flex-shrink: 0;
  color: var(--layout-color-text);
  font-variant-numeric: tabular-nums;
}

.info-cell__label {
  min-width: 0;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
