/** Provenance carried by every graph-store write made by the CRDT follower. */
export interface RemoteMutationContext {
  readonly source: 'agent-remote'
  readonly actor: string
  /** Originating semantic op identity. `replay` marks legacy catch-up frames. */
  readonly opId: string
  /** All effect identities when one replay frame folds several semantic ops. */
  readonly opIds?: readonly string[]
}
