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

import type { OwnerGraph } from './graphOwner'

type IntentGraph = LGraph & OwnerGraph

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
  | { type: 'add_node'; graph: IntentGraph; node: LGraphNode }
  | {
      type: 'remove_node'
      graph: IntentGraph
      node: LGraphNode
      removedLinkIds: readonly LinkId[]
    }
  | { type: 'connect'; graph: IntentGraph; link: LLink }
  | { type: 'disconnect'; graph: IntentGraph; link: LLink }
  | { type: 'clear'; graphId: string; nodeIds: readonly NodeId[] }
  | {
      type: 'set_widget'
      graphId: string
      nodeId: NodeId
      name: string
      value: unknown
      previous: unknown
    }
  | ({
      type: 'set_node_field'
      graph: IntentGraph
      nodeId: NodeId
    } & NodeFieldWrite)

export type GraphIntentEvent = GraphIntent & { source: GraphIntentSource }

type GraphIntentListener = (event: GraphIntentEvent) => void

interface RootScopedSource {
  source: GraphIntentSource
  rootGraph: OwnerGraph
  enclosing: RootScopedSource | null
}

const listeners = new Set<GraphIntentListener>()
let activeSource: GraphIntentSource = 'local'
let rootScopedSource: RootScopedSource | null = null

export function onGraphIntent(listener: GraphIntentListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function withGraphIntentSource<T>(
  source: GraphIntentSource,
  fn: () => T
): T {
  const previousSource = activeSource
  const previousScope = rootScopedSource
  activeSource = source
  rootScopedSource = null
  try {
    return fn()
  } finally {
    activeSource = previousSource
    rootScopedSource = previousScope
  }
}

/** Tags only the intents raised inside `rootGraph`; another document keeps the enclosing source. */
export function withGraphIntentSourceForRootGraph<T>(
  source: GraphIntentSource,
  rootGraph: OwnerGraph,
  fn: () => T
): T {
  const enclosing = rootScopedSource
  rootScopedSource = { source, rootGraph, enclosing }
  try {
    return fn()
  } finally {
    rootScopedSource = enclosing
  }
}

function raisedInside(intent: GraphIntent, rootGraph: OwnerGraph): boolean {
  return 'graph' in intent
    ? intent.graph.rootGraph === rootGraph
    : intent.graphId === rootGraph.id
}

function sourceFor(intent: GraphIntent): GraphIntentSource {
  for (let scope = rootScopedSource; scope; scope = scope.enclosing) {
    if (raisedInside(intent, scope.rootGraph)) return scope.source
  }
  return activeSource
}

export function emitGraphIntent(intent: GraphIntent): void {
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
