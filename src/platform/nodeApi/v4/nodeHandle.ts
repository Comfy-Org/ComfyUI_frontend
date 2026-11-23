import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { Rect } from '@comfyorg/shared-frontend-utils/geometry'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { isReissuable } from '@/platform/nodeApi/shared/documentHandles'
import type { DocumentHandles } from '@/platform/nodeApi/shared/documentHandles'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { savedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { Bounds, NodeHandle, NodeMode } from './types'

export interface NodeHandles {
  /** The handle for the node with `id` in `graph`, if there is one. */
  find(graph: LGraph | undefined, id: string): NodeHandle | undefined
  /** A handle for each node of `graphs` that `include` accepts, graph by graph. */
  list(
    graphs: readonly LGraph[],
    include?: (node: LGraphNode) => boolean
  ): readonly NodeHandle[]
  /**
   * For a node handle made here, what finds its node in the handle's own graph
   * and document while the node is there; `undefined` for anything else.
   */
  locator(value: unknown): (() => LiveNode | undefined) | undefined
}

export interface LiveNode {
  readonly graph: LGraph
  readonly node: LGraphNode
}

/** The node handle members other modules own, such as its edit methods. */
export type NodeHandleMembers = Omit<NodeHandle, keyof NodeHandleReads>
type NodeHandleReads = ReturnType<typeof nodeReads>

export function createNodeHandles(
  handles: DocumentHandles,
  membersFor: (handle: NodeHandleReads) => NodeHandleMembers
): NodeHandles {
  const copyOfSaved = savedCopier()
  const cache = handles.createCache<NodeHandle, LiveNode>((graph, id) =>
    isReissuable(id, graph.state.lastNodeId)
  )

  function handleFor(graph: LGraph, node: LGraphNode): NodeHandle {
    const { id } = node
    return cache.handleFor(
      graph,
      String(id),
      (current) => liveNode(current, id),
      (locate) => {
        const reads = nodeReads(graph.id, id, locate, copyOfSaved)
        return Object.freeze(Object.assign(reads, membersFor(reads)))
      }
    )
  }

  return {
    find(graph, id) {
      if (typeof id !== 'string') throw invalidArgument('node', 'a node id', id)
      const node = graph?.getNodeById(toNodeId(id))
      return graph && node ? handleFor(graph, node) : undefined
    },
    list(graphs, include = () => true) {
      return Object.freeze(
        graphs.flatMap((graph) =>
          graph.nodes.filter(include).map((node) => handleFor(graph, node))
        )
      )
    },
    locator: cache.locator
  }
}

function liveNode(graph: LGraph, id: NodeId): LiveNode | undefined {
  const node = graph.getNodeById(id)
  return node ? { graph, node } : undefined
}

function nodeReads(
  graphId: string,
  id: NodeId,
  locate: () => LiveNode | undefined,
  copyOfSaved: SavedCopier
) {
  function readLive<T>(read: (node: LGraphNode) => T): T | undefined {
    const live = locate()
    return live ? read(live.node) : undefined
  }

  return {
    id,
    graphId,
    get isDeleted() {
      return !locate()
    },
    get type() {
      return readLive((node) => node.type)
    },
    get comfyClass() {
      return readLive((node) => node.comfyClass ?? node.type)
    },

    getTitle: () => readLive(({ title }) => text(title)),
    getMode: () => readLive((node) => MODE_NAMES.get(node.mode)),
    isCollapsed: () => readLive((node) => !!node.flags.collapsed),
    isPinned: () => readLive((node) => !!node.flags.pinned),
    getColor: () => readLive(({ color }) => text(color)),
    getBgColor: () => readLive(({ bgcolor }) => text(bgcolor)),

    getProperty(name: string) {
      if (typeof name !== 'string') {
        throw invalidArgument('getProperty', 'a property name', name)
      }
      return readLive((node) => property(node, name, copyOfSaved))
    },
    getProperties: () =>
      readLive(({ properties }) => copyOfSaved('getProperties', properties)),
    getPosition: () => readLive(({ pos: [x, y] }) => Object.freeze({ x, y })),
    getSize: () =>
      readLive(({ size: [width, height] }) => Object.freeze({ width, height })),
    getBounds: () => readLive(boundsOnCanvas)
  }
}

/** The public name of each node mode that has one. */
export const MODE_NAMES: ReadonlyMap<LGraphEventMode, NodeMode> = new Map([
  [LGraphEventMode.ALWAYS, 'always'],
  [LGraphEventMode.NEVER, 'never'],
  [LGraphEventMode.BYPASS, 'bypass']
])

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function property(
  node: LGraphNode,
  name: string,
  copyOfSaved: SavedCopier
): unknown {
  const { properties } = node
  return Object.hasOwn(properties, name)
    ? copyOfSaved('getProperty', properties[name])
    : undefined
}

export function boundsOnCanvas(node: LGraphNode): Bounds {
  const bounds: Rect = [0, 0, 0, 0]
  const collapsedWidth = node._collapsed_width
  node.measure(bounds, titleMeasuringContext())
  node._collapsed_width = collapsedWidth
  const [x, y, width, height] = bounds
  return Object.freeze({ x, y, width, height })
}

let titleContext: CanvasRenderingContext2D | null = null

function titleMeasuringContext(): CanvasRenderingContext2D | undefined {
  titleContext ??= document.createElement('canvas').getContext('2d')
  return titleContext ?? undefined
}
