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

/**
 * Root map holding the document's passthrough keys (`groups`, `extra`, ...).
 * `@comfyorg/comfy-multi-player` reads it through its private `metaMap()`,
 * which is not part of the package's public surface.
 */
const META_ROOT = 'meta'

export function docMetaMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>(META_ROOT)
}
