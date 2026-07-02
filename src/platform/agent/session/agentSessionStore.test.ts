import { describe, expect, it } from 'vitest'

import type { AgentEvent } from '../common/agentProtocol'
import { createSessionState, sessionReducer } from './agentSessionStore'
import type { SessionState } from './agentSessionStore'

function reduce(state: SessionState, events: AgentEvent[]): SessionState {
  return events.reduce(
    (acc, event) => sessionReducer(acc, { type: 'agent-event', event }),
    state
  )
}

describe('sessionReducer', () => {
  it('accumulates streaming deltas into one agent message', () => {
    const start = sessionReducer(createSessionState('t-1'), {
      type: 'user-send',
      id: 'u-1',
      content: 'hello'
    })

    const next = reduce(start, [
      {
        type: 'agent_message_delta',
        threadId: 't-1',
        messageId: 'm-1',
        delta: 'Hi '
      },
      {
        type: 'agent_message_delta',
        threadId: 't-1',
        messageId: 'm-1',
        delta: 'there'
      }
    ])

    expect(next.messages).toHaveLength(2)
    expect(next.messages[1]).toMatchObject({
      role: 'agent',
      content: 'Hi there',
      streaming: true
    })
    expect(next.status).toBe('streaming')
  })

  it('does not mutate the previous state (structural sharing)', () => {
    const before = createSessionState('t-1')
    const after = sessionReducer(before, {
      type: 'user-send',
      id: 'u-1',
      content: 'hello'
    })

    expect(before.messages).toHaveLength(0)
    expect(after.messages).toHaveLength(1)
    expect(after).not.toBe(before)
  })

  it('tracks tool-call lifecycle and surfaces errors', () => {
    const next = reduce(createSessionState('t-1'), [
      {
        type: 'agent_tool_call',
        threadId: 't-1',
        messageId: 'm-1',
        toolCallId: 'tc-1',
        toolName: 'load_graph',
        status: 'running'
      },
      {
        type: 'agent_tool_call',
        threadId: 't-1',
        messageId: 'm-1',
        toolCallId: 'tc-1',
        toolName: 'load_graph',
        status: 'error',
        errorCode: 'BAD_GRAPH'
      }
    ])

    expect(next.messages[0].toolCalls).toHaveLength(1)
    expect(next.messages[0].toolCalls[0]).toMatchObject({
      status: 'error',
      errorCode: 'BAD_GRAPH'
    })
    expect(next.status).toBe('error')
  })

  it('ends streaming on done', () => {
    const next = reduce(createSessionState('t-1'), [
      {
        type: 'agent_message_delta',
        threadId: 't-1',
        messageId: 'm-1',
        delta: 'x'
      },
      { type: 'agent_message_done', threadId: 't-1', messageId: 'm-1' }
    ])

    expect(next.messages[0].streaming).toBe(false)
    expect(next.status).toBe('idle')
  })
})
