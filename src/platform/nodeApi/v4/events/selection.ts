import { watch } from 'vue'

import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'

import { parseSelectableKey } from '@/core/selection/selectionState'
import type { SelectableKind } from '@/core/selection/selectionState'
import { useSelectionStore } from '@/core/selection/selectionStore'
import type { LGraph } from '@/lib/litegraph/src/LGraph'

import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import type { GroupsOf } from '@/platform/nodeApi/v4/edit/groupHandles'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type {
  GroupHandle,
  NodeHandle,
  Unsubscribe
} from '@/platform/nodeApi/v4/types'

/** The selected nodes of `graph`, in its order, from the host's selection store. */
export function selectedNodes(
  nodes: NodeHandles,
  graph: LGraph | null | undefined
): readonly NodeHandle[] {
  if (!graph) return Object.freeze([])
  const selected = selectedIds(graph, 'node')
  return nodes.list([graph], (node) => selected.has(String(node.id)))
}

/** The selected groups of `graph`, in its draw order, from the host's selection store. */
export function selectedGroups(
  groupsOf: GroupsOf,
  graph: LGraph | null | undefined
): readonly GroupHandle[] {
  if (!graph) return Object.freeze([])
  const selected = selectedIds(graph, 'group')
  return Object.freeze(groupsOf(graph).filter(({ id }) => selected.has(id)))
}

function selectedIds(graph: LGraph, kind: SelectableKind): Set<string> {
  return new Set(
    useSelectionStore()
      .selectedKeys(graphScopeOf(graph))
      .map(parseSelectableKey)
      .flatMap((key) => (key.kind === kind ? [key.id] : []))
  )
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
