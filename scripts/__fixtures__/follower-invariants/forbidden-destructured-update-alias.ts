import * as Y from 'yjs'

const followerDoc = new Y.Doc()
const { applyUpdate: integrate } = Y
integrate(followerDoc, new Uint8Array())
