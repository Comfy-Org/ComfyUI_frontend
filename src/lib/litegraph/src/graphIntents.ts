import type {
  LGraph,
  LGraphNode,
  LLink
} from '@comfyorg/graph-model/entityRegistry'
/**
 * Graph mutations announced as commands from the graph-API funnel they run
 * through (`LGraph.add/remove/_addLink/_removeLink/clear`, the widget value
 * seam), tagged with the caller's provenance. The agent's doc minter listens
 * here instead of reverse-engineering intent from store deltas.
 *
 * Provenance is a synchronous, innermost-wins scope: `LGraph.configure`
 * marks itself `load`, the CRDT applier marks its writes `agent-remote`, and
 * every other caller is `local` by default.
 */
import { reportError } from '@comfyorg/telemetry/reportError'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

export type GraphIntentSource = 'local' | 'agent-remote' | 'load'

/**
 * A scalar node field written as its own register: `null` returns a flag to
 * absent. Mirrors the wire vocabulary's `set_node_field` fields.
 */
export type NodeFieldWrite =
  | { field: 'title'; value: string }
  | { field: 'mode'; value: number }
  | { field: 'flags.collapsed' | 'flags.pinned'; value: boolean | null }

export type GraphIntent =
  | { type: 'add_node'; graph: LGraph; node: LGraphNode }
  | {
      type: 'remove_node'
      graph: LGraph
      node: LGraphNode
      removedLinkIds: readonly LinkId[]
    }
  | { type: 'connect'; graph: LGraph; link: LLink }
  | { type: 'disconnect'; graph: LGraph; link: LLink }
  | { type: 'clear'; graphId: string; nodeIds: readonly NodeId[] }
  | {
      type: 'set_widget'
      graphId: string
      nodeId: NodeId
      name: string
      value: unknown
      previous: unknown
    }
  | ({ type: 'set_node_field'; graph: LGraph; nodeId: NodeId } & NodeFieldWrite)

export type GraphIntentEvent = GraphIntent & { source: GraphIntentSource }

type GraphIntentListener = (event: GraphIntentEvent) => void

interface GraphScopedSource {
  source: GraphIntentSource
  graphIds: ReadonlySet<string>
}

const listeners = new Set<GraphIntentListener>()
let activeSource: GraphIntentSource = 'local'
let graphScopedSource: GraphScopedSource | null = null
let severedLinkSink: LinkId[] | null = null

export function onGraphIntent(listener: GraphIntentListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function withGraphIntentSource<T>(
  source: GraphIntentSource,
  fn: () => T
): T {
  const previousSource = activeSource
  const previousScope = graphScopedSource
  activeSource = source
  graphScopedSource = null
  try {
    return fn()
  } finally {
    activeSource = previousSource
    graphScopedSource = previousScope
  }
}

/**
 * Narrows `source` to the intents `graphIds` raise. A graph disposal runs
 * every node's removal lifecycle synchronously, so an extension callback can
 * edit a different, still-live graph inside the scope; that edit keeps the
 * outer provenance instead of being relabelled as part of the disposal.
 */
export function withGraphIntentSourceForGraphs<T>(
  source: GraphIntentSource,
  graphIds: Iterable<string>,
  fn: () => T
): T {
  const previous = graphScopedSource
  graphScopedSource = { source, graphIds: new Set(graphIds) }
  try {
    return fn()
  } finally {
    graphScopedSource = previous
  }
}

function sourceFor(intent: GraphIntent): GraphIntentSource {
  if (graphScopedSource === null) return activeSource
  const graphId = 'graph' in intent ? intent.graph.id : intent.graphId
  return graphScopedSource.graphIds.has(graphId)
    ? graphScopedSource.source
    : activeSource
}

/**
 * Runs `fn` with every `disconnect` intent it raises folded into `severed`
 * instead of announced: a node removal severs its links as one command.
 */
export function collectingSeveredLinks<T>(severed: LinkId[], fn: () => T): T {
  const previous = severedLinkSink
  severedLinkSink = severed
  try {
    return fn()
  } finally {
    severedLinkSink = previous
  }
}

/**
 * Announces a node field write. A node its graph does not hold yet (still
 * being constructed or configured before `graph.add`) announces nothing: the
 * `add_node` that follows carries the field.
 */
export function emitNodeFieldWrite(
  node: LGraphNode,
  write: NodeFieldWrite
): void {
  if (node.graph?.getNodeById(node.id) !== node) return
  emitGraphIntent({
    type: 'set_node_field',
    graph: node.graph,
    nodeId: node.id,
    ...write
  })
}

export function emitGraphIntent(intent: GraphIntent): void {
  if (intent.type === 'disconnect' && severedLinkSink) {
    severedLinkSink.push(intent.link.id)
    return
  }
  const source = sourceFor(intent)
  const event: GraphIntentEvent = { ...intent, source }
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'graph_intent_listener_failed',
        context: { intent: intent.type, source }
      })
    }
  }
}
