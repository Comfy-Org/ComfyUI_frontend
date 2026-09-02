import * as Y from 'yjs'

const REMOTE_DOC_UPDATE_ORIGIN = Symbol('remote-doc-update')

/**
 * Thrown by {@link FollowerDoc.applyRemoteUpdate} when `Y.applyUpdate` rejects
 * the bytes (malformed/corrupt update). Carries the original Yjs error so a
 * caller's `reportError` retains the real stack, while still letting callers
 * `instanceof`-narrow this specific failure apart from any other throw.
 */
export class FollowerApplyError extends Error {
  constructor(cause: unknown) {
    super(
      `CRDT follower: Y.applyUpdate rejected a remote update: ${String(cause)}`,
      { cause }
    )
    this.name = 'FollowerApplyError'
  }
}

export class FollowerDoc extends EventTarget {
  readonly doc = new Y.Doc()
  updatesApplied = 0

  /**
   * @throws FollowerApplyError when `Y.applyUpdate` throws on malformed or
   * corrupt bytes. `updatesApplied` is not incremented and no `update` event
   * is dispatched for a rejected update — the doc is left exactly as it was
   * before the call (Yjs does not partially apply a rejected update).
   */
  applyRemoteUpdate(update: Uint8Array): void {
    try {
      Y.applyUpdate(this.doc, update, REMOTE_DOC_UPDATE_ORIGIN)
    } catch (error) {
      throw new FollowerApplyError(error)
    }
    this.updatesApplied++
    this.dispatchEvent(
      new CustomEvent('update', {
        detail: { update, updatesApplied: this.updatesApplied }
      })
    )
  }

  stateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc)
  }

  destroy(): void {
    this.doc.destroy()
  }
}
