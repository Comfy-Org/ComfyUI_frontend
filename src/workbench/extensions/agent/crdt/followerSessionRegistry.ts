import { assert } from '@/base/assert'

const ADR =
  'docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md'

const UNBOUND = '\u0000unbound'

function keyFor(documentId: string | null): string {
  return documentId ?? UNBOUND
}

/** One holder's claim on a follower session. */
export interface FollowerSessionLease<T> {
  readonly session: T
  /** Give up this holder's claim. A repeat release of one handle is a no-op. */
  release(): void
}

export interface FollowerSessionRegistry<T> {
  /** Claim the page's follower session on behalf of `documentId`. */
  acquire(documentId: string | null): FollowerSessionLease<T>
  /** Document ids with at least one holder, in acquisition order. */
  heldDocumentIds(): readonly string[]
  /** How many holders claim the session for `documentId`. */
  holderCount(documentId: string | null): number
  /** The live session, or null when nothing holds one. */
  session(): T | null
  /** Drop every lease and dispose the session. For page teardown and tests. */
  destroy(): void
}

/**
 * Lifetime owner for the CRDT follower session, keyed by the workflow document
 * its holders claim it for. Created on the first claim, disposed when the last
 * holder releases. See {@link ADR} Decisions 1 and 3.
 */
export function createFollowerSessionRegistry<T>(
  create: () => { session: T; dispose: () => void }
): FollowerSessionRegistry<T> {
  const holders = new Map<string, Set<object>>()
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
      const key = keyFor(documentId)
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
      const handles = holders.get(key) ?? new Set<object>()
      handles.add(handle)
      holders.set(key, handles)

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
          holders.get(key)?.delete(handle)
          if (holders.get(key)?.size === 0) holders.delete(key)
          if (totalHolders() === 0) disposeEntry()
        }
      }
    },
    heldDocumentIds() {
      return [...holders.keys()].filter((key) => key !== UNBOUND)
    },
    holderCount(documentId) {
      return holders.get(keyFor(documentId))?.size ?? 0
    },
    session() {
      return entry?.session ?? null
    },
    destroy() {
      disposeEntry()
    }
  }
}
