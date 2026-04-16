<script setup lang="ts">
/**
 * BentoView — App Mode runtime view.
 *
 * Solution 04 (Phase 4-A): LinearPreview is the full-viewport background;
 * system chrome (mode toggle, feedback, utility icons) floats in the
 * bento grid above it; a single right-dock FloatingPanel overlays inputs
 * + run on the right side. Drag, resize, persistence, and multi-panel
 * land in later phases (4-B through 4-I).
 */
import { useEventListener } from '@vueuse/core'
import { computed, ref, shallowRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

import BentoGrid from './BentoGrid.vue'
import type { BentoCellPlacement } from './BentoGrid.vue'
import IconCell from './cells/IconCell.vue'
import FeedbackCell from './cells/FeedbackCell.vue'
import ModeToggleCell from './cells/ModeToggleCell.vue'
import type { InputCellEntry } from './cells/InputCell.vue'
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

const { isDragging, snapTarget, onHeaderPointerDown } = usePanelDrag({
  currentPreset: panelPreset,
  onCommit: (preset) => {
    panelPreset.value = preset
  }
})

// --- Chrome cells only (mode toggle, feedback, utility column) ----------
const cells = computed<BentoCellPlacement[]>(() => {
  const out: BentoCellPlacement[] = []

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

  out.push({
    id: 'feedback',
    col: 1,
    row: -2,
    colSpan: 4,
    kind: 'system-feedback'
  })

  return out
})
</script>

<template>
  <div class="bento-view">
    <!-- Background layer: output canvas fills the viewport. -->
    <div class="bento-view__background">
      <LinearPreview />
    </div>

    <!-- Chrome layer: floating utility cells sit above the background. -->
    <BentoGrid :cells="cells">
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
        <FeedbackCell v-else-if="cell.kind === 'system-feedback'" />
      </template>
    </BentoGrid>

    <!-- Overlay layer: the floating panel(s). Phase 4-A: one panel;
         Phase 4-C: drag between presets. -->
    <FloatingPanel
      :preset="panelPreset"
      :dragging="isDragging"
      :on-header-pointer-down="onHeaderPointerDown"
    >
      <PanelBlockList
        :rows="panelRows"
        :input-entry-map="inputEntryMap"
        :on-reorder="moveBlock"
      />
    </FloatingPanel>

    <PanelDragPreview v-if="isDragging" :preset="snapTarget" />
  </div>
</template>

<!-- Design tokens cascade to all cells + panels inside .bento-view. -->
<style src="./design-tokens.css"></style>

<style scoped>
.bento-view {
  position: absolute;
  inset: 0;
  background-color: var(--bento-color-canvas);
}

.bento-view__background {
  position: absolute;
  inset: 0;
  z-index: 0;
}

/* Lift the chrome grid above the background and make it transparent so
   LinearPreview shows through where there's no chrome cell. */
.bento-view :deep(.bento-grid) {
  z-index: 1;
  background-color: transparent;
  pointer-events: none;
}
.bento-view :deep(.bento-grid) > * {
  pointer-events: auto;
}
</style>
