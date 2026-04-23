/**
 * useAppPanelLayout — shared panel state for App Mode + App Builder.
 *
 * Owns the resolution from `appModeStore.selectedInputs` to
 * `InputCellEntry` objects (needs the LGraph), the reconciliation
 * `watchEffect` that keeps `panelRows` in sync with the selected inputs,
 * and the `moveBlock` 2D reorder math.
 *
 * Both `LayoutView` (runtime) and `BuilderPanel` (edit) consume this so
 * the block layout is the same state across views — rearranging in
 * either place updates the other by construction.
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

export interface InputEntryWithMeta extends InputCellEntry {
  isMultiline: boolean
}

export function useAppPanelLayout() {
  const appModeStore = useAppModeStore()

  // Re-resolve on graph reconfigure (e.g. after app.loadGraphData) so
  // stale selected-input entries get pruned.
  const graphNodes = shallowRef<LGraphNode[]>(app.rootGraph.nodes)
  useEventListener(
    app.rootGraph.events,
    'configured',
    () => (graphNodes.value = app.rootGraph.nodes)
  )

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
          String(widget.sourceNodeId) === storeNodeId &&
          widget.sourceWidgetName === vueWidget.storeName
        )
      })
      if (!matchingWidget) return []

      matchingWidget.slotMetadata = undefined
      matchingWidget.nodeId = String(node.id)

      // widget.options is a generic TOptions at the IBaseWidget boundary,
      // so narrow via an in-check before reading `multiline`. After the
      // narrow TS knows `opts.multiline` is `unknown`, which Boolean()
      // consumes without a further cast.
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
    const desiredInputIds = new Set(
      inputEntries.value.map((e) => `input-${e.key}`)
    )
    const entryByBlockId = new Map(
      inputEntries.value.map((e) => [`input-${e.key}`, e])
    )
    const existingInputIds = new Set<string>()
    for (const row of appModeStore.panelRows) {
      for (const b of row) {
        if (b.kind === 'input') existingInputIds.add(b.id)
      }
    }

    const preserved: BlockRow[] = appModeStore.panelRows
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

    // Structural-equality guard: `watchEffect` re-reads `panelRows`, so
    // an unconditional assignment would create a new array reference on
    // every tick (including after a moveBlock write) and retrigger the
    // effect. isEqual short-circuits the common no-op case cheaply —
    // panelRows stays small (one row per input).
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
 * Pure reorder: return what `panelRows` would be after moving the block
 * at `from` to `target`, without mutating inputs or writing to the
 * store. Returns the original `rows` reference when the move is a noop
 * (column-at-self-position or solo-row-to-own-row-boundary) so callers
 * can identity-check for bail-outs.
 *
 * Shared between `moveBlock` (commit path) and `PanelBlockList`'s drag
 * preview — reproduces the same math so the live preview users see
 * during drag matches exactly what will land on release.
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
