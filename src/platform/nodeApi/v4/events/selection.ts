import { watch } from 'vue'

import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import type { CanvasSource } from '@/platform/nodeApi/v4/canvasSource'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { NodeHandle, Unsubscribe } from '@/platform/nodeApi/v4/types'

export function createSelectionEvents(
  nodes: NodeHandles,
  source: () => CanvasSource | undefined
): (listener: (nodes: readonly NodeHandle[]) => void) => Unsubscribe {
  function selectedNodes(): readonly NodeHandle[] {
    const canvas = source()
    const graph = canvas?.visibleGraph()
    if (!canvas || !graph) return Object.freeze([])
    const selected = canvas.selectedNodeIds()
    return nodes.list([graph], (node) => selected.has(node.id))
  }

  return createHostEvent<[readonly NodeHandle[]]>(
    'onSelectionChanged',
    (emit) =>
      watch(selectedNodes, (selected, previous) => {
        if (!sameNodes(selected, previous)) emit(selected)
      })
  )
}

function sameNodes(
  a: readonly NodeHandle[],
  b: readonly NodeHandle[]
): boolean {
  return a.length === b.length && a.every((node, index) => node === b[index])
}
