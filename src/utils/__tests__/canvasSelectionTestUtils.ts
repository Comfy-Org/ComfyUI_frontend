import type { SelectableKey } from '@/core/selection/selectionState'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { Positionable } from '@/lib/litegraph/src/interfaces'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { selectableKeyOf } from '@/renderer/core/canvas/litegraph/selectionAdapter'
import { useSelectionStore } from '@/renderer/core/canvas/selectionStore'
import { graphScopeOf } from '@/types/graphScopeId'

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
