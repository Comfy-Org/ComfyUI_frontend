/**
 * Selection-change events for the public node API.
 *
 * Selection belongs to the renderer, while the public API lives in
 * `platform/`. The renderer therefore pushes a source through this seam, just
 * as it does for node movement and property changes. Packs receive only node
 * handles; selected groups and reroutes stay renderer details.
 */
import { ComfyApiError } from './errors'
import type { NodeHandle } from './nodeHandle'
import type { Unsubscribe } from './widgetHandle'

export type SelectionSource = (
  listener: (nodeIds: readonly string[]) => void
) => Unsubscribe

let source: SelectionSource | undefined

export function provideSelectionSource(provider: SelectionSource): void {
  source = provider
}

/** Test seam. */
export function resetSelectionSource(): void {
  source = undefined
}

export function createSelectionObserver(
  handleFor: (nodeId: string) => NodeHandle | undefined
) {
  return function onSelectionChanged(
    listener: (nodes: readonly NodeHandle[]) => void
  ): Unsubscribe {
    if (!source) {
      throw new ComfyApiError(
        'Selection changes are unavailable: the host has not provided a source.'
      )
    }
    return source((nodeIds) => {
      const nodes = nodeIds
        .map(handleFor)
        .filter((node): node is NodeHandle => !!node && !node.isDeleted)
      listener(Object.freeze(nodes))
    })
  }
}
