import type { LGraph } from '@comfyorg/graph-model/entityRegistry'

import {
  clearGraphSelection,
  updateGraphSelection
} from '@/renderer/core/canvas/litegraph/selectionAdapter'

import type { Positionable } from '@comfyorg/graph-model/interfaces'

/**
 * Snapshot of the selection store exposed through the legacy
 * `canvas.selectedItems` Set. Mutators dispatch selection commands rather than
 * editing the snapshot, so extensions that still call `add`, `delete` or
 * `clear` keep working while the store remains the only writer. Read
 * `canvas.selectedItems` again to observe the result.
 */
export class SelectedItemsView extends Set<Positionable> {
  constructor(
    items: Iterable<Positionable>,
    private readonly graph: LGraph | null
  ) {
    super()
    for (const item of items) super.add(item)
  }

  override add(item: Positionable): this {
    if (this.graph) updateGraphSelection(this.graph, item, true)
    return this
  }

  override delete(item: Positionable): boolean {
    return this.graph ? updateGraphSelection(this.graph, item, false) : false
  }

  override clear(): void {
    clearGraphSelection(this.graph)
  }
}
