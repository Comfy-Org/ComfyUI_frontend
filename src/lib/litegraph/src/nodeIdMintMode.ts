import { isRootGraphDocBound } from './docBoundGraphs'
import type { NodeIdMintMode } from './idAllocation'

/**
 * `idAllocation.ts` stays pure and context-free, so the mode is decided here:
 * `'crdt-disjoint'` only for a mint landing directly on a root graph that
 * shares its id space with the agent's collaborative doc — subgraph-owned
 * nodes are outside the doc's scope (see `agentNodeMaterializer.ts`) and keep
 * plain sequential ids.
 *
 * Pulled out of `LGraph.ts` (rather than kept private there) so every
 * `mintNodeId` call site that preassigns an id onto a graph — not just
 * `LGraph.add`'s own unassigned-id path — can share this exact decision
 * instead of re-deriving it or defaulting to `'sequential'` by omission.
 */
export function nodeIdMintModeFor(graph: {
  isRootGraph: boolean
  id: string
}): NodeIdMintMode {
  return graph.isRootGraph && isRootGraphDocBound(graph.id)
    ? 'crdt-disjoint'
    : 'sequential'
}
