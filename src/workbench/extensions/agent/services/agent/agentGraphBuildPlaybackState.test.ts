import { describe, expect, it } from 'vitest'

import {
  initialAgentGraphBuildPlaybackState,
  reduceAgentGraphBuildPlayback
} from './agentGraphBuildPlaybackState'
import type {
  AgentGraphBuildPlaybackEvent,
  AgentGraphBuildPlaybackState
} from './agentGraphBuildPlaybackState'

function transition(
  events: AgentGraphBuildPlaybackEvent[]
): AgentGraphBuildPlaybackState {
  return events.reduce(
    reduceAgentGraphBuildPlayback,
    initialAgentGraphBuildPlaybackState
  )
}

describe('agent graph build playback state', () => {
  it('represents an ordered multi-node playback without parallel flags', () => {
    const state = transition([
      { type: 'staged' },
      { type: 'staged' },
      { type: 'started', nodeLabel: 'Load Image' },
      { type: 'cursorMoved', x: 120, y: 480 },
      { type: 'started', nodeLabel: 'KSampler' },
      { type: 'paused' }
    ])

    expect(state).toEqual({
      phase: 'paused',
      current: 2,
      total: 2,
      nodeLabel: 'KSampler',
      cursorX: 120,
      cursorY: 480
    })
  })

  it('starts a newly staged batch after the previous batch completed', () => {
    const state = transition([
      { type: 'staged' },
      { type: 'started', nodeLabel: 'Save Image' },
      { type: 'completed' },
      { type: 'staged' }
    ])

    expect(state).toEqual({ phase: 'queued', total: 1 })
  })

  it('ignores transitions that are invalid for the current phase', () => {
    const state = transition([
      { type: 'paused' },
      { type: 'started', nodeLabel: 'Unexpected' },
      { type: 'cursorMoved', x: 10, y: 20 },
      { type: 'completed' }
    ])

    expect(state).toBe(initialAgentGraphBuildPlaybackState)
  })
})
