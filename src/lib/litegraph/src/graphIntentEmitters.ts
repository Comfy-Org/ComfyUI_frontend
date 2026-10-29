import type {
  LGraph,
  LGraphNode,
  LLink
} from '@comfyorg/graph-model/entityRegistry'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import { emitGraphIntent } from '@comfyorg/graph-state/graphIntents'
import type { NodeFieldWrite } from '@comfyorg/graph-state/graphIntents'

let severedLinkSink: LinkId[] | null = null

/**
 * Runs `fn` with every link disconnect it raises folded into `severed`
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

/** Announces a link disconnect unless a node removal is collecting it. */
export function emitLinkDisconnect(graph: LGraph, link: LLink): void {
  if (severedLinkSink) {
    severedLinkSink.push(link.id)
    return
  }
  emitGraphIntent({ type: 'disconnect', graph, link })
}

/**
 * Announces a node field write. A node its graph does not hold yet announces
 * nothing: the `add_node` that follows carries the field.
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
