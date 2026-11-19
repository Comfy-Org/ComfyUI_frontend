import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import { containsCentre } from '@/lib/litegraph/src/measure'

import { isReissuable } from '@/platform/nodeApi/shared/documentHandles'
import type { DocumentHandles } from '@/platform/nodeApi/shared/documentHandles'
import { boundsOnCanvas } from '@/platform/nodeApi/v4/nodeHandle'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { Bounds, GroupHandle } from '@/platform/nodeApi/v4/types'

/** The one handle for each group of a graph, in draw order. */
export type GroupsOf = (graph: LGraph) => readonly GroupHandle[]

export interface GroupHandles {
  readonly groupsOf: GroupsOf
  /**
   * For a group handle made here, what finds its group in the handle's own
   * graph and document while the group is there; `undefined` for anything else.
   */
  locator(value: unknown): (() => LiveGroup | undefined) | undefined
}

interface LiveGroup {
  readonly graph: LGraph
  readonly group: LGraphGroup
}

/** The group handle members other modules own: its edit methods. */
export type GroupHandleMembers = Pick<GroupHandle, 'setBounds'>

export function createGroupHandles(
  handles: DocumentHandles,
  nodes: NodeHandles,
  membersFor: (handle: object) => GroupHandleMembers,
  centerOn: (graph: LGraph, area: Bounds) => boolean
): GroupHandles {
  const cache = handles.createCache<GroupHandle, LiveGroup>((graph, id) =>
    isReissuable(id, graph.state.lastGroupId)
  )

  function handleFor(graph: LGraph, id: string): GroupHandle {
    return cache.handleFor(
      graph,
      id,
      (current) => liveGroup(current, id),
      (locate) => {
        const reads = groupReads(id, locate, nodes, centerOn)
        return Object.freeze(Object.assign(reads, membersFor(reads)))
      }
    )
  }

  return {
    groupsOf: (graph) =>
      Object.freeze(
        graph.groups.map((group) => handleFor(graph, String(group.id)))
      ),
    locator: cache.locator
  }
}

function liveGroup(graph: LGraph, id: string): LiveGroup | undefined {
  const group = graph.groups.find((candidate) => String(candidate.id) === id)
  return group && { graph, group }
}

function groupReads(
  id: string,
  locate: () => LiveGroup | undefined,
  nodes: NodeHandles,
  centerOn: (graph: LGraph, area: Bounds) => boolean
) {
  function readLive<T>(
    read: (group: LGraphGroup, graph: LGraph) => T
  ): T | undefined {
    const live = locate()
    return live ? read(live.group, live.graph) : undefined
  }

  return {
    id,
    get isDeleted() {
      return !locate()
    },
    getTitle: () => readLive((group) => group.title),
    getColor: () => readLive((group) => group.color),
    getBounds: () => readLive(boundsOf),
    centerOn: () =>
      readLive((group, graph) => centerOn(graph, boundsOf(group))) ?? false,
    nodes: () =>
      readLive((group, graph) => {
        const area = group.boundingRect
        return nodes.list([graph], (node) => {
          const { x, y, width, height } = boundsOnCanvas(node)
          return containsCentre(area, [x, y, width, height])
        })
      })
  }
}

function boundsOf(group: LGraphGroup): Bounds {
  const [x, y, width, height] = group.boundingRect
  return Object.freeze({ x, y, width, height })
}
