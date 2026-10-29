import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { Positionable } from '@comfyorg/graph-model/interfaces'

import type { SelectableKey } from '@/core/selection/selectionState'
import { useSelectionStore } from '@/core/selection/selectionStore'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { selectableKeyOf } from '@/renderer/core/canvas/litegraph/selectionAdapter'

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
