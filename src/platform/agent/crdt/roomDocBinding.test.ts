import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { AgentRoom } from './agentRoom'
import { bindRoomToDoc } from './roomDocBinding'

describe('bindRoomToDoc', () => {
  it('seeds the room from the doc and pushes agent edits back', () => {
    const doc = new Y.Doc()
    doc.getMap('nodes').set('existing', { title: 'Existing' })

    const room = new AgentRoom('wf-1')
    const unbind = bindRoomToDoc(room, doc)

    expect(room.nodes.get('existing')).toEqual({ title: 'Existing' })

    room.nodes.set('agent', { title: 'Agent Node' })
    expect(doc.getMap('nodes').get('agent')).toEqual({ title: 'Agent Node' })

    unbind()
    room.nodes.set('after-unbind', {})
    expect(doc.getMap('nodes').has('after-unbind')).toBe(false)
  })

  it('reflects doc edits into the room while bound', () => {
    const doc = new Y.Doc()
    const room = new AgentRoom('wf-1')
    bindRoomToDoc(room, doc)

    doc.getMap('nodes').set('from-canvas', { title: 'Canvas' })
    expect(room.nodes.get('from-canvas')).toEqual({ title: 'Canvas' })
  })
})
