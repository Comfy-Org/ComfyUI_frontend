import * as Y from 'yjs'

export class FollowerDoc {
  readonly doc = new Y.Doc()

  applyRemoteUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update)
  }
}
