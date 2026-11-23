import { shallowRef } from 'vue'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

import { toSelectableKey } from '@/core/selection/selectionState'
import { useSelectionStore } from '@/core/selection/selectionStore'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'

import type {
  CanvasSource,
  NodeMove
} from '@/platform/nodeApi/shared/canvasSource'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'

type MoveFollower = (rootGraphId: string, moves: readonly NodeMove[]) => void

/** A node API over a canvas the test drives, as the renderer would. */
export function apiOnTestCanvas(graph: LGraph | null) {
  const visible = shallowRef(graph)
  const canvas = shallowRef<LGraphCanvas | null>(null)
  const moveFollowers = new Set<MoveFollower>()
  const dragFollowers = new Set<() => void>()
  const source: CanvasSource = {
    visibleGraph: () => visible.value,
    canvas: () => canvas.value,
    followMoves(moved) {
      moveFollowers.add(moved)
      return () => moveFollowers.delete(moved)
    },
    followDragEnds(ended) {
      dragFollowers.add(ended)
      return () => dragFollowers.delete(ended)
    }
  }
  const api = createComfyApi({
    getGraph: () => visible.value,
    canvas: () => source
  })

  return {
    ...api,
    show(next: LGraph | null) {
      visible.value = next
    },
    useCanvas(next: LGraphCanvas) {
      canvas.value = next
    },
    select(...ids: NodeId[]) {
      if (!visible.value) return
      useSelectionStore().apply(graphScopeOf(visible.value), {
        type: 'selection.replace',
        keys: ids.map((id) => toSelectableKey('node', id))
      })
    },
    move(rootGraphId: string, moves: readonly NodeMove[]) {
      for (const moved of moveFollowers) moved(rootGraphId, moves)
    },
    endDrag() {
      for (const ended of dragFollowers) ended()
    },
    followerCount: () => moveFollowers.size + dragFollowers.size
  }
}
