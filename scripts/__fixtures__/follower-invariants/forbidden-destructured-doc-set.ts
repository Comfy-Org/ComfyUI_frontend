import type * as Y from 'yjs'

export const write = (follower: { doc: Y.Doc }): void => {
  const { doc } = follower

  doc.getMap('nodes').set('1', 'KSampler')
}
