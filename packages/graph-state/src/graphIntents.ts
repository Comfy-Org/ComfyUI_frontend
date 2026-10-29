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

const listeners = new Set<GraphIntentListener>()
let activeSource: GraphIntentSource = 'local'

export function onGraphIntent(listener: GraphIntentListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function withGraphIntentSource<T>(
  source: GraphIntentSource,
  fn: () => T
): T {
  const previous = activeSource
  activeSource = source
  try {
    return fn()
  } finally {
    activeSource = previous
  }
}

export function emitGraphIntent(intent: GraphIntent): void {
  const event: GraphIntentEvent = { ...intent, source: activeSource }
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'graph_intent_listener_failed',
        context: { intent: intent.type, source: activeSource }
      })
    }
  }
}
