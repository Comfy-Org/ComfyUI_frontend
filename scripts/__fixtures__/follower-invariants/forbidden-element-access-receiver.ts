import type * as Y from 'yjs'

export function write(sharedDoc: Y.Doc): void {
  sharedDoc['getMap']('nodes').set('1', 'KSampler')
}
