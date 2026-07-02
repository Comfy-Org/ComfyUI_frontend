import { describe, expect, it } from 'vitest'

import { AgentRoomManager } from './agentRoomManager'

describe('AgentRoomManager', () => {
  it('keeps one room alive across overlapping tab references', () => {
    const manager = new AgentRoomManager()
    const first = manager.join('wf-1')
    const second = manager.join('wf-1')

    expect(second).toBe(first)

    manager.leave('wf-1')
    expect(manager.has('wf-1')).toBe(true)

    manager.leave('wf-1')
    expect(manager.has('wf-1')).toBe(false)
  })

  it('keeps a pinned room alive with zero open tabs and reaps on unpin', () => {
    const manager = new AgentRoomManager()
    manager.join('wf-1')
    manager.pin('wf-1')

    manager.leave('wf-1')
    expect(manager.has('wf-1')).toBe(true)

    manager.unpin('wf-1')
    expect(manager.has('wf-1')).toBe(false)
  })
})
