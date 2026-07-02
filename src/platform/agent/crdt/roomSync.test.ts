import { describe, expect, it } from 'vitest'

import { AgentRoom } from './agentRoom'
import type { RoomSyncMessage, RoomTransport } from './roomSync'
import { syncRoom } from './roomSync'

class LoopbackTransport implements RoomTransport {
  private listeners = new Set<(m: RoomSyncMessage) => void>()
  peer: LoopbackTransport | null = null

  send(message: RoomSyncMessage): void {
    this.peer?.listeners.forEach((cb) => cb(message))
  }

  onMessage(cb: (m: RoomSyncMessage) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
}

function connect() {
  const a = new LoopbackTransport()
  const b = new LoopbackTransport()
  a.peer = b
  b.peer = a
  return [a, b] as const
}

describe('syncRoom', () => {
  it('converges existing state on connect via the sync handshake', () => {
    const [t1, t2] = connect()
    const user = new AgentRoom('wf-1')
    const agent = new AgentRoom('wf-1')
    user.nodes.set('a', { title: 'Load Checkpoint' })

    syncRoom(user, t1)
    syncRoom(agent, t2)

    expect(agent.nodes.get('a')).toEqual({ title: 'Load Checkpoint' })
  })

  it('propagates live edits and ignores other workflows', () => {
    const [t1, t2] = connect()
    const user = new AgentRoom('wf-1')
    const agent = new AgentRoom('wf-1')
    syncRoom(user, t1)
    syncRoom(agent, t2)

    agent.nodes.set('b', { title: 'KSampler' })
    expect(user.nodes.get('b')).toEqual({ title: 'KSampler' })

    t2.send({
      type: 'update',
      workflowId: 'other',
      update: agent.encodeState()
    })
    expect(user.nodes.has('b')).toBe(true)
  })
})
