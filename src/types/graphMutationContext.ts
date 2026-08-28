/** Provenance carried by every graph-store write made by the CRDT follower. */
export interface RemoteMutationContext {
  readonly source: 'agent-remote'
  readonly actor: string
  /** The originating semantic op, when this batch contains exactly one op. */
  readonly opId?: string
  /** Effect identities in applier order for a multi-op batch. */
  readonly opIds?: readonly string[]
}

export function isRemoteMutationContext(
  value: unknown
): value is RemoteMutationContext {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<RemoteMutationContext>
  return (
    candidate.source === 'agent-remote' &&
    typeof candidate.actor === 'string' &&
    (typeof candidate.opId === 'string' ||
      (Array.isArray(candidate.opIds) && candidate.opIds.length > 0))
  )
}
