/** Provenance carried by every graph-store write made by the CRDT follower. */
export interface RemoteMutationContext {
  readonly source: 'agent-remote'
  readonly actor: string
  /** Originating semantic op identity. `replay` marks legacy catch-up frames. */
  readonly opId: string
  /** All effect identities when one replay frame folds several semantic ops. */
  readonly opIds?: readonly string[]
  /**
   * This frame is the catch-up a fresh subscription receives, replaying state
   * that already existed rather than reporting anything new.
   */
  readonly hydration?: boolean
}

export function isRemoteMutationContext(
  value: unknown
): value is RemoteMutationContext {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<RemoteMutationContext>
  return (
    candidate.source === 'agent-remote' &&
    typeof candidate.actor === 'string' &&
    typeof candidate.opId === 'string'
  )
}
