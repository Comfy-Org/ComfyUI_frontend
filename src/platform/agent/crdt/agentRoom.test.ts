import { describe, expect, it } from 'vitest'

import { AgentRoom } from './agentRoom'

describe('AgentRoom', () => {
  it('reconciles two peers via state-vector diff without conflict', () => {
    const user = new AgentRoom('wf-1')
    const agent = new AgentRoom('wf-1')

    user.nodes.set('a', { title: 'Load Checkpoint' })
    agent.nodes.set('b', { title: 'KSampler' })

    agent.applyRemoteUpdate(user.diffSince(agent.encodeStateVector()))
    user.applyRemoteUpdate(agent.diffSince(user.encodeStateVector()))

    expect([...user.nodes.keys()].sort()).toEqual(['a', 'b'])
    expect([...agent.nodes.keys()].sort()).toEqual(['a', 'b'])
  })

  it('merges concurrent edits to the same map deterministically', () => {
    const user = new AgentRoom('wf-1')
    const agent = new AgentRoom('wf-1')
    agent.applyRemoteUpdate(user.encodeState())

    user.nodes.set('shared', { x: 1 })
    agent.nodes.set('shared', { x: 2 })

    user.applyRemoteUpdate(agent.diffSince(user.encodeStateVector()))
    agent.applyRemoteUpdate(user.diffSince(agent.encodeStateVector()))

    expect(user.nodes.get('shared')).toEqual(agent.nodes.get('shared'))
  })

  it('reports an agent participant as editing via presence', () => {
    const room = new AgentRoom('wf-1')
    expect(room.isAgentEditing()).toBe(false)

    room.setPresence({
      actor: 'agent-1',
      kind: 'agent',
      status: 'editing',
      focus: ['a'],
      updatedAt: 0
    })

    expect(room.isAgentEditing()).toBe(true)
  })
})
