/**
 * Strongly-typed graph-mutations seam for the CRDT follower (ADR-009).
 *
 * The follower projects the semantic doc into the canvas by producing a batch of
 * these mutations and handing it to a {@link GraphMutator}. The vocabulary is the
 * minimal version of the eventual node-data mutations API: FE-1330 scopes the
 * core to add-node / delete-node / connect; `move_node` / `set_widget` /
 * `disconnect` exist only for render fidelity.
 *
 * A follower NEVER writes the shared doc (KA-#6). Every batch carries its
 * source and actor at the call site. The mutator propagates the remote source
 * into layout operations, while the future semantic capture seam for connect,
 * disconnect, and widget changes must accept this same source-carried context
 * directly. No ambient source scope is part of this contract.
 */
import type { NodeId } from '@/types/nodeId'

export type LinkId = string

export interface NodeSpec {
  readonly id: NodeId
  readonly type: string
  readonly pos: readonly [number, number]
  readonly widgets: Readonly<Record<string, unknown>>
}

export interface LinkSpec {
  readonly id: LinkId
  readonly originId: NodeId
  readonly originSlot: number
  readonly targetId: NodeId
  readonly targetSlot: number
}

export type GraphMutation =
  | { readonly kind: 'add_node'; readonly node: NodeSpec }
  | { readonly kind: 'remove_node'; readonly id: NodeId }
  | {
      readonly kind: 'move_node'
      readonly id: NodeId
      readonly pos: readonly [number, number]
    }
  | {
      readonly kind: 'set_widget'
      readonly id: NodeId
      readonly name: string
      readonly value: unknown
    }
  | { readonly kind: 'connect'; readonly link: LinkSpec }
  | {
      readonly kind: 'disconnect'
      readonly id: LinkId
      readonly targetId: NodeId
      readonly targetSlot: number
    }

/**
 * The only permitted source for a follower-applied batch. A follower applies
 * remote (agent) state; it never originates `local` mutations into the doc.
 */
type MutationSource = 'agent-remote'

interface MutationContext {
  /** Provenance for every mutation in the call, including semantic ops. */
  readonly source: MutationSource
  /** CRDT actor carried alongside provenance for downstream capture. */
  readonly actor: string
}

export interface MutationBatch extends MutationContext {
  readonly mutations: readonly GraphMutation[]
}

/**
 * Sink for projected mutations. `LitegraphMutator` renders to the live canvas
 * today; a `nodeDataStore`/World-command implementation swaps in when the drjkl
 * state-centralization stack lands, with the diff and projector unchanged.
 */
export interface GraphMutator {
  applyBatch(batch: MutationBatch): void
}
