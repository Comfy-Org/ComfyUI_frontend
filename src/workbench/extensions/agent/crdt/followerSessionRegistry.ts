import { assert } from '@/base/assert'

const ADR =
  'docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md'

export interface FollowerSessionLease<T> {
  readonly session: T
  /** Give up this holder's claim. A repeat release never decrements twice. */
  release(): void
}

export interface FollowerSessionRegistry<T> {
  /** Claim the page's follower session on behalf of `documentId`. */
  acquire(documentId: string | null): FollowerSessionLease<T>
  /** Document ids with at least one holder, in acquisition order. */
  heldDocumentIds(): readonly string[]
  holderCount(documentId: string | null): number
  /** The live session, or null when nothing holds one. */
  session(): T | null
  /** Drop every lease and dispose the session. For page teardown and tests. */
  destroy(): void
}

/** Owns one session: created on the first claim, disposed on the last release. */
export function createFollowerSessionRegistry<T>(
  create: () => { session: T; dispose: () => void }
): FollowerSessionRegistry<T> {
  const holders = new Map<string | null, Set<object>>()
  let entry: { session: T; dispose: () => void } | null = null

  const totalHolders = (): number => {
    let total = 0
    for (const handles of holders.values()) total += handles.size
    return total
  }

  const disposeEntry = (): void => {
    const disposing = entry
    entry = null
    holders.clear()
    disposing?.dispose()
  }

  return {
    acquire(documentId) {
      if (entry === null) {
        assert(
          totalHolders() === 0,
          `minted a follower session while holders were already recorded — the registry owns one session per document and never mints a second replica for it, see ${ADR} Decision 3`,
          { holders: totalHolders(), documentId }
        )
        entry = create()
      }
      const held = entry
      const handle = {}
      const handles = holders.get(documentId) ?? new Set<object>()
      handles.add(handle)
      holders.set(documentId, handles)

      let released = false
      return {
        session: held.session,
        release() {
          if (released) {
            assert(
              false,
              `released the same follower session lease twice — a lease handle is released once; a repeat release must not decrement the holder count, see ${ADR} Decision 1`
            )
            return
          }
          released = true
          const heldSessionWasDisposed = entry !== held
          if (heldSessionWasDisposed) return
          holders.get(documentId)?.delete(handle)
          if (holders.get(documentId)?.size === 0) holders.delete(documentId)
          if (totalHolders() === 0) disposeEntry()
        }
      }
    },
    heldDocumentIds() {
      return [...holders.keys()].filter((key): key is string => key !== null)
    },
    holderCount(documentId) {
      return holders.get(documentId)?.size ?? 0
    },
    session() {
      return entry?.session ?? null
    },
    destroy() {
      disposeEntry()
    }
  }
}
