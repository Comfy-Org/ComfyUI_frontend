<script setup lang="ts">
/**
 * BentoView — App Mode runtime view rebuilt around the bento grid.
 *
 * Prototype scope: hard-coded cell layout matching design/mockups/grid-system-001.png.
 * System-pinned cells port the existing AppModeToolbar functionality:
 *   - Mode toggle (App ↔ Graph dropdown)
 *   - Builder (hammer)
 *   - Share (cloud + sharing-flag only)
 *   - Assets (sidebar tab toggle)
 *   - Apps (sidebar tab toggle)
 *   - Help (placeholder)
 *   - Run (placeholder)
 *
 * Stub input/output cells are visible boxes for now; real widget/output
 * rendering swaps in next.
 */
import { useEventListener } from '@vueuse/core'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

import BentoGrid from './BentoGrid.vue'
import type { BentoCellPlacement } from './BentoGrid.vue'
import IconCell from './cells/IconCell.vue'
import RunCell from './cells/RunCell.vue'
import FeedbackCell from './cells/FeedbackCell.vue'
import ModeToggleCell from './cells/ModeToggleCell.vue'
import InputCell from './cells/InputCell.vue'
import type { InputCellEntry } from './cells/InputCell.vue'
import OutputsCell from './cells/OutputsCell.vue'
import BatchCountCell from './cells/BatchCountCell.vue'

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

// --- Per-input cell data ------------------------------------------------
// Replicates the filtered-nodeData pattern from AppModeWidgetList so that
// each selected input can be rendered in its own bento cell with just its
// own widget inside, not the full node's widget list.

const graphNodes = shallowRef<LGraphNode[]>(app.rootGraph.nodes)
useEventListener(
  app.rootGraph.events,
  'configured',
  () => (graphNodes.value = app.rootGraph.nodes)
)

interface InputEntryWithConfig extends InputCellEntry {
  config: { col?: number; row?: number; colSpan?: number; rowSpan?: number }
  isMultiline: boolean
}

const inputEntries = computed<InputEntryWithConfig[]>(() => {
  // Read graphNodes so we recompute when nodes are added/removed
  void graphNodes.value
  const nodeDataByNode = new Map<
    LGraphNode,
    ReturnType<typeof extractVueNodeData>
  >()

  return appModeStore.selectedInputs.flatMap(([nodeId, widgetName, config]) => {
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
        config: config ?? {},
        isMultiline
      }
    ]
  })
})

// Map input-cell id → entry so the template can look up by cell id.
const inputEntryMap = computed(
  () => new Map(inputEntries.value.map((e) => [`input-${e.key}`, e]))
)

// Layout matches design/mockups/grid-system-001.png:
// - Col 1 holds a vertical stack of utility icon cells
// - Col 2-3 row 1 hosts the App↔Graph mode toggle
// - Col 1 row 8 is the Help cell
// - Col 11-12 row 8 is the Run cell
// - Stub input/output cells fill the remaining space for visual demo
const cells = computed<BentoCellPlacement[]>(() => {
  const out: BentoCellPlacement[] = []

  // System-pinned utility column (col 1)
  let row = 1
  if (enableAppBuilder.value) {
    out.push({ id: 'builder', col: 1, row: row++, kind: 'system-builder' })
  }
  if (showShare.value) {
    out.push({ id: 'share', col: 1, row: row++, kind: 'system-share' })
  }
  out.push({ id: 'assets', col: 1, row: row++, kind: 'system-assets' })
  out.push({ id: 'apps', col: 1, row: row++, kind: 'system-apps' })

  // Mode toggle (col 2-3, row 1)
  out.push({
    id: 'mode-toggle',
    col: 2,
    row: 1,
    colSpan: 2,
    kind: 'system-mode-toggle'
  })

  // Feedback (bottom-left) — 3 cols wide so the "App mode in beta /
  // Give feedback" text fits next to the Typeform button.
  // row: -2 anchors to last row regardless of grid size.
  out.push({
    id: 'feedback',
    col: 1,
    row: -2,
    colSpan: 4,
    kind: 'system-feedback'
  })

  // Run (bottom-right) — 5 cols wide so the label has room to breathe.
  out.push({ id: 'run', col: -6, row: -2, colSpan: 5, kind: 'system-run' })

  // Batch count (one row above Run, same column span). First label/
  // widget pair broken into its own bento cell — pilots Phase 2.
  out.push({
    id: 'batch-count',
    col: -6,
    row: -3,
    colSpan: 5,
    kind: 'system-batch-count'
  })

  // Outputs hero. Ends a few cols before the right edge so the wider
  // per-input cells (col -11, colSpan 10) sit cleanly beside it.
  // Phase 2b will split this into per-output cells.
  out.push({
    id: 'outputs',
    col: 4,
    row: 1,
    colSpan: 10,
    rowSpan: 10,
    kind: 'outputs'
  })

  // Phase 2a: per-input cells. Each selected input becomes its own cell,
  // auto-stacked in a right-side column wide enough for the NodeWidgets
  // 3-column grid to breathe. Heuristic: textareas / multiline widgets
  // take 4 rows; everything else takes 2 rows.
  //
  // NOTE: stored per-widget layout config (colSpan/col/row in linearData)
  // is intentionally ignored here. Earlier experiments wrote colSpan
  // values into some workflows that now fight the heuristic. Phase 3
  // will reintroduce stored-config support once drag/resize is wired.
  const INPUT_COL = -11
  const INPUT_COL_SPAN = 10
  let nextInputRow = 1
  for (const entry of inputEntries.value) {
    const rowSpan = entry.isMultiline ? 4 : 2
    out.push({
      id: `input-${entry.key}`,
      col: INPUT_COL,
      row: nextInputRow,
      colSpan: INPUT_COL_SPAN,
      rowSpan,
      kind: 'input'
    })
    nextInputRow += rowSpan
  }

  return out
})
</script>

<template>
  <div class="bento-view">
    <BentoGrid :cells="cells" fill-empty>
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
        <RunCell v-else-if="cell.kind === 'system-run'" />
        <BatchCountCell v-else-if="cell.kind === 'system-batch-count'" />
        <InputCell
          v-else-if="cell.kind === 'input' && inputEntryMap.get(cell.id)"
          :entry="inputEntryMap.get(cell.id)!"
        />
        <OutputsCell v-else-if="cell.kind === 'outputs'" />
        <div v-else class="bento-stub" :data-stub-kind="cell.kind" />
      </template>
    </BentoGrid>
  </div>
</template>

<style scoped>
.bento-view {
  /* Fill the parent wrapper (LinearView sets position:relative on it)
     and serve as the positioning context for the absolutely-positioned
     BentoGrid inside. */
  position: absolute;
  inset: 0;
  background-color: var(--p-content-background, #1a1a1a);
}

.bento-stub {
  width: 100%;
  height: 100%;
}
</style>
