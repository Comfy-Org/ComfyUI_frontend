import {
  parseSelectableKey,
  toSelectableKey
} from '@/core/selection/selectionState'
import type { SelectableKey } from '@/core/selection/selectionState'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

import { Subgraph } from '../LGraph'
import type { LGraph } from '../LGraph'
import { LGraphGroup } from '../LGraphGroup'
import { LGraphNode } from '../LGraphNode'
import { Reroute } from '../Reroute'
import type { Positionable } from '../interfaces'

export function selectableKeyOf(item: Positionable): SelectableKey {
  if (item instanceof LGraphNode) return toSelectableKey('node', item.id)
  if (item instanceof LGraphGroup) return toSelectableKey('group', item.id)
  if (item instanceof Reroute) return toSelectableKey('reroute', item.id)
  return toSelectableKey('io', item.id)
}

export function resolveSelectable(
  graph: LGraph,
  key: SelectableKey
): Positionable | undefined {
  const { kind, id } = parseSelectableKey(key)
  switch (kind) {
    case 'node':
      return graph.getNodeById(toNodeId(id)) ?? undefined
    case 'group':
      return graph._groups.find((group) => String(group.id) === id)
    case 'reroute':
      return graph.getReroute(toRerouteId(Number(id)))
    case 'io':
      if (!(graph instanceof Subgraph)) return undefined
      return [graph.inputNode, graph.outputNode].find(
        (ioNode) => String(ioNode.id) === id
      )
  }
}
