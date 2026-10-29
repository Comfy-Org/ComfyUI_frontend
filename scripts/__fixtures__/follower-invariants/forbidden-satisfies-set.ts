import type * as Y from 'yjs'

export function write(followerDoc: object): void {
  const doc = followerDoc satisfies object as Y.Doc
  doc.getMap('nodes').set('1', 'KSampler')
}
