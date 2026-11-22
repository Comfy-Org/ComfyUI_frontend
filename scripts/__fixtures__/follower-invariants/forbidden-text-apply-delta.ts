import * as Y from 'yjs'

const followerDoc = new Y.Doc()

followerDoc.getText('text').applyDelta([{ insert: 'x' }])
