import * as Y from 'yjs'

const REMOTE_DOC_UPDATE_ORIGIN = Symbol('remote-doc-update')

export class FollowerDoc extends EventTarget {
  readonly doc = new Y.Doc()
  updatesApplied = 0

  /**
   * `Y.applyUpdate` integrates structs as it decodes them, so a malformed
   * frame would leave the doc holding its readable prefix. Decoding the whole
   * frame first makes the apply all-or-nothing.
   */
  applyRemoteUpdate(update: Uint8Array): void {
    Y.decodeUpdate(update)
    Y.applyUpdate(this.doc, update, REMOTE_DOC_UPDATE_ORIGIN)
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
