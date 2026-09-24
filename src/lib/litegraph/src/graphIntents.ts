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
import { reportError } from '@/platform/telemetry/reportError'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'

import type { LGraph } from './LGraph'
import type { LGraphNode } from './LGraphNode'
import type { LLink } from './LLink'

export type GraphIntentSource = 'local' | 'agent-remote' | 'load'

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

export type GraphIntentEvent = GraphIntent & { source: GraphIntentSource }

type GraphIntentListener = (event: GraphIntentEvent) => void

const listeners = new Set<GraphIntentListener>()
let activeSource: GraphIntentSource = 'local'
let severedLinkSink: LinkId[] | null = null

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

export function emitGraphIntent(intent: GraphIntent): void {
  if (intent.type === 'disconnect' && severedLinkSink) {
    severedLinkSink.push(intent.link.id)
    return
  }
  const event: GraphIntentEvent = { ...intent, source: activeSource }
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      reportError(error, {
        errorType: 'graph_intent_listener_failed',
        context: { intent: intent.type, source: activeSource }
      })
    }
  }
}
