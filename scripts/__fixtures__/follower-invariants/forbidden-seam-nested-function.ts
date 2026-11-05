import * as Y from 'yjs'

export class FollowerDoc {
  readonly doc = new Y.Doc()

  applyRemoteUpdate(update: Uint8Array): { reseed(): void } {
    class Other {
      readonly doc = new Y.Doc()

      reseed(): void {
        Y.applyUpdate(this.doc, update)
      }
    }
    return new Other()
  }
}
