import type { SelectionCommand } from '@/core/selection/selectionState'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { Positionable } from '@/lib/litegraph/src/interfaces'
import {
  resolveSelectable,
  selectableKeyOf
} from '@/lib/litegraph/src/utils/selectableItems'
import { useSelectionStore } from '@/renderer/core/canvas/selectionStore'
import { graphScopeOf } from '@/types/graphScopeId'

export function setCanvasItemSelected(
  canvas: LGraphCanvas,
  item: Positionable,
  selected: boolean
): void {
  const key = selectableKeyOf(item)
  if (!key) return
  item.selected = selected
  if (selected) canvas.selectedItems.add(item)
  else canvas.selectedItems.delete(item)
  canvas.state.selectionChanged = true
  applyCanvasSelection(canvas, {
    type: selected ? 'selection.add' : 'selection.remove',
    key
  })
}

export function applyCanvasSelection(
  canvas: LGraphCanvas,
  command: SelectionCommand
): void {
  const { graph } = canvas
  if (!graph) return
  useSelectionStore().apply(graphScopeOf(graph), command)
}

export function ownsSelectable(
  canvas: LGraphCanvas,
  item: Positionable
): boolean {
  const { graph } = canvas
  const key = selectableKeyOf(item)
  return !!graph && !!key && resolveSelectable(graph, key) === item
}
