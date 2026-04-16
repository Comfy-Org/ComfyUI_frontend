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
import FloatingPanel from './panels/FloatingPanel.vue'
import PanelBlockList from './panels/PanelBlockList.vue'
import PanelDragPreview from './panels/PanelDragPreview.vue'
import type {
  BlockConfig,
  BlockPos,
  BlockRow,
  DropTarget,
  PanelPreset
} from './panels/panelTypes'
import { usePanelDrag } from './panels/usePanelDrag'

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
import { useWorkspaceStore } from '@/stores/workspaceStore'
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
const workspaceStore = useWorkspaceStore()
const workflowStore = useWorkflowStore()
const { toastErrorHandler } = useErrorHandling()
const { flags } = useFeatureFlags()

const isAssetsActive = computed(
  () => workspaceStore.sidebarTab.activeSidebarTab?.id === 'assets'
)
const isAppsActive = computed(
  () => workspaceStore.sidebarTab.activeSidebarTab?.id === 'apps'
)

const showShare = computed(() => isCloud && flags.workflowSharingEnabled)

function openAssets() {
  void commandStore.execute('Workspace.ToggleSidebarTab.assets')
}
function showApps() {
  void commandStore.execute('Workspace.ToggleSidebarTab.apps')
}
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

const panelPreset = ref<PanelPreset>('right-dock')

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

  // Find (or create) the trailing run row.
  let runRowIdx = preserved.findIndex((r) => r.some((b) => b.kind === 'run'))
  if (runRowIdx === -1) {
    preserved.push([{ id: 'run', kind: 'run', withBatchCount: true }])
    runRowIdx = preserved.length - 1
  }

  // Append brand-new inputs as single-block rows, above the run row.
  for (const entry of inputEntries.value) {
    const id = `input-${entry.key}`
    if (existingInputIds.has(id)) continue
    const newBlock: BlockConfig = {
      id,
      kind: 'input',
      entryKey: entry.key,
      isMultiline: entry.isMultiline
    }
    preserved.splice(runRowIdx, 0, [newBlock])
    runRowIdx += 1
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

// Separate input rows (scrollable body) from run rows (pinned footer).
const inputRows = computed(() =>
  panelRows.value.filter((row) => !row.some((b) => b.kind === 'run'))
)
const runRow = computed(() =>
  panelRows.value.find((row) => row.some((b) => b.kind === 'run'))
)

const { isDragging, snapTarget, onHeaderPointerDown } = usePanelDrag({
  currentPreset: panelPreset,
  onCommit: (preset) => {
    panelPreset.value = preset
  }
})

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

/** Middle-truncate a filename like a hash: `first…last`. Preserves the
 *  extension when present. 4/4 chars each side matches what the user
 *  asked for ("1234…5678"). */
function truncateMiddle(name: string, head = 4, tail = 4): string {
  if (!name) return ''
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 && dot > name.length - 6 ? name.slice(dot) : ''
  const base = ext ? name.slice(0, dot) : name
  if (base.length <= head + tail + 1) return name
  return `${base.slice(0, head)}…${base.slice(-tail)}${ext}`
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
const infoLabel = computed(() => truncateMiddle(infoName.value))
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

  let row = 1
  if (enableAppBuilder.value) {
    out.push({ id: 'builder', col: 1, row: row++, kind: 'system-builder' })
  }
  if (showShare.value) {
    out.push({ id: 'share', col: 1, row: row++, kind: 'system-share' })
  }
  out.push({ id: 'assets', col: 1, row: row++, kind: 'system-assets' })
  out.push({ id: 'apps', col: 1, row: row++, kind: 'system-apps' })

  out.push({
    id: 'mode-toggle',
    col: 2,
    row: 1,
    colSpan: 2,
    kind: 'system-mode-toggle'
  })

  // Action cells on row 1, right of the mode toggle. Only mount when
  // a history item is selected (mirrors LinearPreview's top bar).
  if (hasSelection.value) {
    out.push({ id: 'action-rerun', col: 4, row: 1, kind: 'action-rerun' })
    out.push({
      id: 'action-reuse-params',
      col: 5,
      row: 1,
      kind: 'action-reuse-params'
    })
    out.push({
      id: 'action-download',
      col: 6,
      row: 1,
      kind: 'action-download'
    })
    out.push({
      id: 'action-info',
      col: 7,
      row: 1,
      colSpan: 5,
      kind: 'action-info'
    })
  }

  out.push({
    id: 'feedback',
    col: 1,
    row: -2,
    colSpan: 4,
    kind: 'system-feedback'
  })

  // History thumbs: one per row, stacking down column 1 immediately
  // below the icon stack (no gap).
  const thumbStartRow = row
  for (let i = 0; i < historyThumbs.value.length; i++) {
    out.push({
      id: historyThumbs.value[i].id,
      col: 1,
      row: thumbStartRow + i,
      kind: 'output-thumb'
    })
  }

  return out
})
</script>

<template>
  <div class="layout-view">
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
          :label="t('actionbar.shareTooltip')"
          :on-activate="openShare"
          @pointerenter="prefetchShareDialog"
        />
        <IconCell
          v-else-if="cell.kind === 'system-assets'"
          icon="icon-[comfy--image-ai-edit]"
          :label="t('sideToolbar.mediaAssets.title')"
          :active="isAssetsActive"
          :on-activate="openAssets"
        />
        <IconCell
          v-else-if="cell.kind === 'system-apps'"
          icon="icon-[lucide--panels-top-left]"
          :label="t('linearMode.appModeToolbar.apps')"
          :active="isAppsActive"
          :on-activate="showApps"
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
      :preset="panelPreset"
      :title="panelTitle"
      :dragging="isDragging"
      :on-header-pointer-down="onHeaderPointerDown"
    >
      <PanelBlockList
        :rows="inputRows"
        :input-entry-map="inputEntryMap"
        :on-reorder="moveBlock"
      />
      <template v-if="runRow" #footer>
        <PanelBlockList :rows="[runRow]" :input-entry-map="inputEntryMap" />
      </template>
    </FloatingPanel>

    <PanelDragPreview v-if="isDragging" :preset="snapTarget" />
  </div>
</template>

<!-- Design tokens cascade to all cells + panels inside .layout-view. -->
<style src="./design-tokens.css"></style>

<style scoped>
.layout-view {
  position: absolute;
  inset: 0;
  background-color: var(--layout-color-canvas);
  /* Clip LinearPreview's inner absolute-positioned layers (image,
     skeletons, welcome) so they can never paint above the layout-view
     box — which sits below the top workflow-tabs bar. */
  overflow: hidden;
  /* Own stacking context so our z-indexed children (background, grid,
     panel, drag preview) compose cleanly without reaching outside. */
  isolation: isolate;
  /* Reserve the right-dock panel's footprint so centered children
     (LinearWelcome) visually center in the panel-free area rather than
     the raw viewport. Consumed as padding-right in LinearWelcome;
     defaults to 0 outside .layout-view (old splitter App Mode). */
  --welcome-panel-offset: calc(
    var(--panel-dock-width, 420px) + var(--layout-outer-padding, 16px)
  );
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
