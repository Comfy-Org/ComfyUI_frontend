import { watch } from 'vue'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'

import { parseSelectableKey } from '@/core/selection/selectionState'
import { useSelectionStore } from '@/core/selection/selectionStore'
import type { LGraph } from '@/lib/litegraph/src/LGraph'

import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { NodeHandle, Unsubscribe } from '@/platform/nodeApi/v4/types'

/** The selected nodes of `graph`, in its order, from the host's selection store. */
export function selectedNodes(
  nodes: NodeHandles,
  graph: LGraph | null | undefined
): readonly NodeHandle[] {
  if (!graph) return Object.freeze([])
  const selected = new Set(
    useSelectionStore()
      .selectedKeys(graphScopeOf(graph))
      .map(parseSelectableKey)
      .flatMap(({ kind, id }) => (kind === 'node' ? [id] : []))
  )
  return nodes.list([graph], (node) => selected.has(String(node.id)))
}

export function createSelectionEvents(
  nodes: NodeHandles,
  visibleGraph: () => LGraph | null
): (listener: (nodes: readonly NodeHandle[]) => void) => Unsubscribe {
  return createHostEvent<[readonly NodeHandle[]]>(
    'onSelectionChanged',
    (emit) =>
      watch(
        () => selectedNodes(nodes, visibleGraph()),
        (selected, previous) => {
          if (!sameNodes(selected, previous)) emit(selected)
        }
      )
  )
}

function sameNodes(
  a: readonly NodeHandle[],
  b: readonly NodeHandle[]
): boolean {
  return a.length === b.length && a.every((node, index) => node === b[index])
}
