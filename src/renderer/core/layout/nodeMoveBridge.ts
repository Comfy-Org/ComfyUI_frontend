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
import { watch } from 'vue'

import {
  provideNodeDragEndSource,
  provideNodeMoveSource
} from '@/platform/nodeApi/interaction'

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

  // Nodes 2.0 only: `isDraggingVueNodes` is the sole drag lifecycle either
  // renderer publishes. Under the legacy canvas the flag never moves, so
  // `onNodeDragEnd` simply never fires there.
  provideNodeDragEndSource((onDragEnd) => {
    // Accumulated during the drag rather than reported per move, so a pack is
    // handed the whole set once instead of rebuilding it from a stream.
    const moved = new Set<string>()

    const stopCollecting = layoutStore.onChange((change: LayoutChange) => {
      if (change.operation.type !== 'moveNode') return
      if (!layoutStore.isDraggingVueNodes.value) return
      for (const nodeId of change.nodeIds) moved.add(String(nodeId))
    })

    const stopWatching = watch(
      () => layoutStore.isDraggingVueNodes.value,
      (dragging, wasDragging) => {
        if (dragging || !wasDragging) return
        if (moved.size) onDragEnd([...moved])
        moved.clear()
      }
    )

    return () => {
      stopCollecting()
      stopWatching()
    }
  })
}
