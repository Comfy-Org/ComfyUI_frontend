import type { SelectableKey } from '@comfyorg/graph-state/selection/selectionState'
import type { LGraph } from '@comfyorg/litegraph/LGraph'
import type { Positionable } from '@comfyorg/graph-model/interfaces'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { selectableKeyOf } from '@comfyorg/litegraph/canvas/selectionAdapter'
import { useSelectionStore } from '@comfyorg/graph-state/selection/selectionStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'

/**
 * Overrides the derived `canvasStore.selectedItems` for tests whose items
 * belong to no graph. Relies on `@pinia/testing` making getters writable.
 */
export function setCanvasSelection(items: Positionable[]): void {
  const store: { selectedItems: Positionable[] } = useCanvasStore()
  store.selectedItems = items
}

export function saveSelection(graph: LGraph, item: Positionable): void {
  const key = selectableKeyOf(item)
  if (!key) return
  useSelectionStore().apply(graphScopeOf(graph), { type: 'selection.add', key })
}

export function savedSelectionKeys(graph: LGraph): readonly SelectableKey[] {
  return useSelectionStore().selectedKeys(graphScopeOf(graph))
}
