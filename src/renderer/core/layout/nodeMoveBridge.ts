/**
 * Feeds node movement from the layout store to the published node API.
 *
 * The API lives in `platform/` and cannot import `renderer/`, so the source is
 * pushed down rather than pulled up — the same seam `registerBadgeRowsProvider`
 * uses to keep litegraph out of the store.
 *
 * Both renderers route movement through `layoutMutations.moveNode`, so this one
 * subscription serves the canvas and Nodes 2.0 alike.
 */
import { provideNodeMoveSource } from '@/platform/nodeApi/interaction'

import { layoutStore } from './store/layoutStore'
import type { LayoutChange } from './types'

export function installNodeMoveBridge(): void {
  provideNodeMoveSource((onMove) =>
    layoutStore.onChange((change: LayoutChange) => {
      if (change.operation.type !== 'moveNode') return
      for (const nodeId of change.nodeIds) {
        onMove(String(nodeId), change.operation.position)
      }
    })
  )
}
