import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { Rect } from '@comfyorg/shared-frontend-utils/geometry'
import { reportError } from '@comfyorg/telemetry/reportError'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import type {
  DocumentHandles,
  GraphResolver
} from '@/platform/nodeApi/shared/documentHandles'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
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
  const cache = handles.createCache<NodeHandle>(
    (graph, id) => graph.getNodeById(toNodeId(id)) !== null
  )
  const liveNodes = new WeakMap<object, () => LiveNode | undefined>()

  function handleFor(graph: LGraph, node: LGraphNode): NodeHandle {
    return cache.handleFor(graph, node.id, (resolveGraph) => {
      const locate = locator(resolveGraph, node.id)
      const reads = nodeReads(graph.id, node.id, locate, copyOfSaved)
      const handle = Object.freeze(Object.assign(reads, membersFor(reads)))
      liveNodes.set(handle, locate)
      return handle
    })
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
    locator: (value) =>
      typeof value === 'object' && value !== null
        ? liveNodes.get(value)
        : undefined
  }
}

function locator(
  resolveGraph: GraphResolver,
  id: NodeId
): () => LiveNode | undefined {
  return () => {
    const graph = resolveGraph()
    const node = graph?.getNodeById(id)
    return graph && node ? { graph, node } : undefined
  }
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
    getMode: () => readLive((node) => MODE_NAMES[node.mode]),
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

export const MODE_NAMES: Readonly<Record<LGraphEventMode, NodeMode>> = {
  [LGraphEventMode.ALWAYS]: 'always',
  [LGraphEventMode.NEVER]: 'never',
  [LGraphEventMode.BYPASS]: 'bypass',
  [LGraphEventMode.ON_EVENT]: 'on-event',
  [LGraphEventMode.ON_TRIGGER]: 'on-trigger'
}

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

type SavedCopier = <T>(member: string, value: T) => T | undefined

function savedCopier(): SavedCopier {
  const reported = new Set<string>()
  return (member, value) => {
    let saved: { value: typeof value }
    try {
      saved = JSON.parse(JSON.stringify({ value }))
    } catch (error) {
      if (!reported.has(member)) {
        reported.add(member)
        reportError(error, {
          errorType: 'node_api_property_not_savable',
          surface: 'platform',
          level: 'warning',
          tags: { member }
        })
      }
      return undefined
    }
    return deepFreeze(saved.value)
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function boundsOnCanvas(node: LGraphNode): Bounds {
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
