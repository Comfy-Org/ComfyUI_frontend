import { describe, expect, it } from 'vitest'

import { zAgentConversation } from '../browser_tests/fixtures/data/agent/agentConversation'
import { exportAgentConversation } from './agentConversationCapture'

const turn = {
  message_id: 'message-1',
  request: { content: 'Add a node' },
  frames: [
    {
      type: 'agent_tool_call',
      data: {
        thread_id: 'thread-1',
        message_id: 'message-1',
        tool_call_id: 'tool-1',
        tool_name: 'add_node',
        status: 'running'
      }
    },
    {
      type: 'agent_tool_call',
      data: {
        thread_id: 'thread-1',
        message_id: 'message-1',
        tool_call_id: 'tool-1',
        tool_name: 'add_node',
        status: 'success'
      }
    }
  ],
  tool_calls: [
    {
      tool_call_id: 'tool-1',
      applied_op_ids: ['op-accepted'],
      result: {
        data: {
          ops: [
            { op: 'add_node', op_id: 'op-accepted', node_id: 1 },
            { op: 'add_node', op_id: 'op-rejected', node_id: 2 }
          ]
        }
      }
    }
  ]
} as const

const capture = {
  schema_version: 'agent-backend-capture.v2',
  source: {
    repo: 'Comfy-Org/evals',
    suite: 'agent',
    case_id: 'recorded-case'
  },
  capture: {
    backend: 'Comfy-Org/cloud',
    thread_id: 'thread-1',
    exported_at: '2026-09-02T16:00:00.000Z'
  },
  workflow: {
    id: '6f1c2c1e-3b1c-4c88-9d9c-0d6e9b8e1a01',
    name: 'Captured workflow',
    catalog: { types: {} },
    seed: { nodes: [], links: [] }
  },
  turns: [turn]
} as const

const withTurn = (patch: Partial<typeof turn>) => ({
  ...capture,
  turns: [{ ...turn, ...patch }]
})

describe('exportAgentConversation', () => {
  it('interleaves only durably applied backend ops before the terminal frame', () => {
    const conversation = exportAgentConversation(capture)

    expect(conversation.source).toMatchObject({
      response_side: 'recorded',
      capture: capture.capture
    })
    expect(conversation.turns[0].response).toEqual([
      {
        kind: 'event',
        event: {
          type: 'agent_tool_call',
          data: {
            tool_call_id: 'tool-1',
            tool_name: 'add_node',
            status: 'running'
          }
        }
      },
      {
        kind: 'graph_ops',
        ops: [{ op: 'add_node', op_id: 'op-accepted', node_id: 1 }]
      },
      {
        kind: 'event',
        event: {
          type: 'agent_tool_call',
          data: {
            tool_call_id: 'tool-1',
            tool_name: 'add_node',
            status: 'success'
          }
        }
      }
    ])
  })

  it('emits each entry at its offset from the first recorded frame', () => {
    const [running, success] = turn.frames
    const exported = exportAgentConversation(
      withTurn({
        frames: [
          { ...running, at_ms: 1_700_000_001_000 },
          { ...success, at_ms: 1_700_000_001_750 }
        ]
      })
    )
    const [{ response }] = exported.turns
    expect(response.map((entry) => entry.at_ms)).toEqual([0, 750, 750])
    expect(
      response.every(
        (entry) => entry.kind !== 'event' || !('at_ms' in entry.event)
      )
    ).toBe(true)
  })

  it('leaves the offset out when the frames carry no receipt time', () => {
    const [{ response }] = exportAgentConversation(capture).turns
    expect(response.every((entry) => entry.at_ms === undefined)).toBe(true)
  })

  it('refuses a tool-call frame with a missing status', () => {
    const [running, success] = turn.frames
    const { status: _status, ...withoutStatus } = success.data
    expect(() =>
      exportAgentConversation(
        withTurn({ frames: [running, { ...success, data: withoutStatus }] })
      )
    ).toThrow(/status undefined/)
  })

  it('refuses a tool-call frame with an unknown status', () => {
    const [running, success] = turn.frames
    expect(() =>
      exportAgentConversation(
        withTurn({
          frames: [
            running,
            { ...success, data: { ...success.data, status: 'done' } }
          ]
        })
      )
    ).toThrow(/status "done"/)
  })

  it('refuses an accepted op missing from the recorded result', () => {
    expect(() =>
      exportAgentConversation(
        withTurn({
          tool_calls: [
            { ...turn.tool_calls[0], applied_op_ids: ['op-not-in-result'] }
          ]
        })
      )
    ).toThrow('accepted op op-not-in-result')
  })

  it('refuses to silently omit a mutating backend call', () => {
    expect(() =>
      exportAgentConversation(withTurn({ frames: [turn.frames[0]] }))
    ).toThrow('no terminal websocket frame for tool call(s): tool-1')
  })

  it('refuses a websocket frame from another turn', () => {
    expect(() =>
      exportAgentConversation(
        withTurn({
          frames: [
            {
              ...turn.frames[0],
              data: { ...turn.frames[0].data, message_id: 'another-message' }
            }
          ]
        })
      )
    ).toThrow('does not belong to turn thread-1/message-1')
  })

  it('exports every turn of the thread in order with its own frames', () => {
    const second = {
      ...turn,
      message_id: 'message-2',
      request: { content: 'Connect it' },
      frames: turn.frames.map((frame) => ({
        ...frame,
        data: { ...frame.data, message_id: 'message-2' }
      }))
    }
    const exported = exportAgentConversation({
      ...capture,
      turns: [turn, second]
    })
    expect(
      exported.turns.map((exportedTurn) => exportedTurn.message_id)
    ).toEqual(['message-1', 'message-2'])
    expect(exported.turns[1].request).toEqual({ content: 'Connect it' })
    expect(exported.turns[1].response).toHaveLength(3)
  })

  it('refuses a recorded turn without the message id it came from', () => {
    const conversation = exportAgentConversation(capture)
    const { message_id: _messageId, ...anonymous } = conversation.turns[0]
    expect(() =>
      zAgentConversation.parse({ ...conversation, turns: [anonymous] })
    ).toThrow('recorded turns carry the message id')
  })

  it('refuses a recorded label without backend provenance', () => {
    const conversation = exportAgentConversation(capture)
    const { capture: _capture, ...source } = conversation.source

    expect(() => zAgentConversation.parse({ ...conversation, source })).toThrow(
      'recorded responses require backend capture provenance'
    )
  })
})
