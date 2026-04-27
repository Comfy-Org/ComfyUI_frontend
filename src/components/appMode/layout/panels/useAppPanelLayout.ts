/**
 * Shared panel state for App Mode + App Builder. Resolves
 * `appModeStore.selectedInputs` against the LGraph into
 * `InputCellEntry`s, keeps `panelRows` reconciled with that, and
 * exposes 2D reorder. Both LayoutView (runtime) and BuilderPanel
 * (edit) consume this so the layout is one shared state across views.
 */
import { useEventListener } from '@vueuse/core'
import { isEqual } from 'es-toolkit'
import { computed, shallowRef, watchEffect } from 'vue'

import { extractVueNodeData } from '@/composables/graph/useGraphNodeManager'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import { resolveNodeWidget } from '@/utils/litegraphUtil'

import type { InputCellEntry } from '../cells/InputCell.vue'
import type { BlockConfig, BlockPos, BlockRow, DropTarget } from './panelTypes'

interface InputEntryWithMeta extends InputCellEntry {
  isMultiline: boolean
}

export function useAppPanelLayout() {
  const appModeStore = useAppModeStore()

  // Re-resolve on graph reconfigure (after app.loadGraphData) so
  // stale entries get pruned. rootGraph may be null in transitions —
  // VueUse re-binds the listener when the getter target appears.
  const graphNodes = shallowRef<LGraphNode[]>(app.rootGraph?.nodes ?? [])
  useEventListener(
    () => app.rootGraph?.events,
    'configured',
    () => (graphNodes.value = app.rootGraph?.nodes ?? [])
  )

  const inputEntries = computed<InputEntryWithMeta[]>(() => {
    // Touching `graphNodes.value` registers the dep so the computed
    // re-runs on rootGraph rebind; the typed shape guarantees an
    // array so this is an explicit no-op guard.
    if (!graphNodes.value) return []
    const nodeDataByNode = new Map<
      LGraphNode,
      ReturnType<typeof extractVueNodeData>
    >()

    return appModeStore.selectedInputs.flatMap(([nodeId, widgetName]) => {
      const [node, widget] = resolveNodeWidget(nodeId, widgetName)
      if (!widget || !node || node.mode !== LGraphEventMode.ALWAYS) return []

      let fullNodeData = nodeDataByNode.get(node)
      if (!fullNodeData) {
        fullNodeData = extractVueNodeData(node)
        nodeDataByNode.set(node, fullNodeData)
      }

      const matchingWidget = fullNodeData.widgets?.find((vueWidget) => {
        if (vueWidget.slotMetadata?.linked) return false
        if (!node.isSubgraphNode()) return vueWidget.name === widget.name
        const storeNodeId = vueWidget.storeNodeId?.split(':')?.[1] ?? ''
        return (
          isPromotedWidgetView(widget) &&
          String(widget.sourceNodeId) === storeNodeId &&
          widget.sourceWidgetName === vueWidget.storeName
        )
      })
      if (!matchingWidget) return []

      matchingWidget.slotMetadata = undefined
      matchingWidget.nodeId = String(node.id)

      // widget.options is a generic TOptions at the IBaseWidget
      // boundary; narrow via in-check before reading `multiline`.
      const opts: unknown = widget.options
      const isMultiline =
        (typeof opts === 'object' &&
          opts !== null &&
          'multiline' in opts &&
          Boolean(opts.multiline)) ||
        String(widget.type).toLowerCase() === 'customtext'

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

  // Keep the store's panelRows in sync with the resolved inputs:
  // preserve existing rows/columns, drop blocks whose entry is gone,
  // refresh sizing meta, and append new inputs as single-block rows.
  watchEffect(() => {
    const entryByBlockId = new Map(
      inputEntries.value.map((e) => [`input-${e.key}`, e])
    )
    const existingInputIds = new Set<string>()
    for (const row of appModeStore.panelRows) {
      for (const b of row) {
        if (b.kind === 'input') existingInputIds.add(b.id)
      }
    }

    // Drop blocks whose entry is gone (entry-missing == undesired).
    const preserved: BlockRow[] = appModeStore.panelRows
      .map(
        (row): BlockRow =>
          row.flatMap((block): BlockConfig[] => {
            if (block.kind === 'input') {
              const entry = entryByBlockId.get(block.id)
              if (!entry) return []
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

    // Equality guard: an unconditional assignment would re-trigger
    // this watchEffect on every tick (even after a moveBlock write).
    if (!isEqual(preserved, appModeStore.panelRows)) {
      appModeStore.panelRows = preserved
    }
  })

  function moveBlock(from: BlockPos, target: DropTarget) {
    appModeStore.panelRows = applyMove(appModeStore.panelRows, from, target)
  }

  return {
    inputEntries,
    inputEntryMap,
    moveBlock
  }
}

/**
 * Pure reorder of `panelRows`. Returns the original `rows` reference
 * for noop moves (column-at-self, solo-row-to-own-row-boundary) so
 * callers can identity-check. Shared between the commit path and
 * PanelBlockList's drag preview so what users see during drag matches
 * what lands on release.
 */
export function applyMove(
  rows: BlockRow[],
  from: BlockPos,
  target: DropTarget
): BlockRow[] {
  if (!rows[from.row] || rows[from.row][from.col] === undefined) return rows
  const moved = rows[from.row][from.col]

  // --- Noop detection on pre-removal grid ------------------------------
  const isSoloRow = rows[from.row].length === 1

  if (
    (target.kind === 'columnBefore' || target.kind === 'columnAfter') &&
    target.rowIndex === from.row &&
    target.colIndex === from.col
  ) {
    return rows
  }
  if (
    isSoloRow &&
    (target.kind === 'newRowBefore' || target.kind === 'newRowAfter') &&
    target.rowIndex === from.row
  ) {
    return rows
  }

  // Clone rows (shallow) so the input stays untouched.
  const result: BlockRow[] = rows.map((r) => r.slice())

  // --- Remove from source ----------------------------------------------
  result[from.row].splice(from.col, 1)
  const sourceRowRemoved = result[from.row].length === 0
  if (sourceRowRemoved) result.splice(from.row, 1)

  // --- Insert at destination -------------------------------------------
  const shiftForRemovedRow = (idx: number) =>
    sourceRowRemoved && from.row < idx ? idx - 1 : idx

  if (target.kind === 'newRowBefore' || target.kind === 'newRowAfter') {
    const base =
      target.kind === 'newRowAfter' ? target.rowIndex + 1 : target.rowIndex
    const destRow = shiftForRemovedRow(base)
    result.splice(destRow, 0, [moved])
  } else {
    const destRow = shiftForRemovedRow(target.rowIndex)
    const row = result[destRow]
    if (!row) return rows
    let destCol = target.colIndex
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

  return result
}
