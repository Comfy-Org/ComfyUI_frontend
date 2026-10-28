import type * as Y from 'yjs'

export function write(follower: { doc: Y.Doc }): void {
  const { doc } = follower

  doc.getMap('nodes').set('1', 'KSampler')
}
