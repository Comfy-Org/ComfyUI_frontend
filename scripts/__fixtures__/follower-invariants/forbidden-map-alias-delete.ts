import * as Y from 'yjs'

const sharedDoc = new Y.Doc()
const nodes = sharedDoc.getMap('nodes')

nodes.delete('1')
