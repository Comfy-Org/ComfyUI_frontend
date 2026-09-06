import type { SelectionCommand } from '@/core/selection/selectionState'

import type { Positionable } from '../interfaces'
import { selectableKeyOf } from '../utils/selectableItems'

/**
 * Snapshot of the selection store exposed through the legacy
 * `canvas.selectedItems` Set. Mutators dispatch selection commands rather than
 * editing the snapshot, so extensions that still call `add`, `delete` or
 * `clear` keep working while the store remains the only writer. Read
 * `canvas.selectedItems` again to observe the result.
 */
export class SelectedItemsView extends Set<Positionable> {
  readonly #dispatch: (command: SelectionCommand) => void

  constructor(
    items: Iterable<Positionable>,
    dispatch: (command: SelectionCommand) => void
  ) {
    super()
    this.#dispatch = dispatch
    for (const item of items) super.add(item)
  }

  override add(item: Positionable): this {
    this.#dispatch({ type: 'selection.add', keys: [selectableKeyOf(item)] })
    return this
  }

  override delete(item: Positionable): boolean {
    const wasSelected = this.has(item)
    this.#dispatch({ type: 'selection.remove', keys: [selectableKeyOf(item)] })
    return wasSelected
  }

  override clear(): void {
    this.#dispatch({ type: 'selection.clear' })
  }
}
