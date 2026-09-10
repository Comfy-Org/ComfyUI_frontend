import { describe, expect, it } from 'vitest'

import { zAgentConversation } from '../browser_tests/fixtures/data/agent/agentConversation'
import { exportAgentConversation } from './agentConversationCapture'

const capture = {
  schema_version: 'agent-backend-capture.v1',
  source: {
    repo: 'Comfy-Org/evals',
    suite: 'agent',
    case_id: 'recorded-case'
  },
  capture: {
    backend: 'Comfy-Org/cloud',
    thread_id: 'thread-1',
    message_id: 'message-1',
    exported_at: '2026-09-02T16:00:00.000Z'
  },
  workflow: {
    id: '6f1c2c1e-3b1c-4c88-9d9c-0d6e9b8e1a01',
    name: 'Captured workflow',
    catalog: { types: {} },
    seed: { nodes: [], links: [] }
  },
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
            {
              op: 'add_node',
              op_id: 'op-accepted',
              node_id: 1,
              class_type: 'PreviewImage',
              pos: [0, 0],
              node: { id: 1, type: 'PreviewImage' }
            },
            {
              op: 'add_node',
              op_id: 'op-rejected',
              node_id: 2,
              class_type: 'PreviewImage',
              pos: [0, 100],
              node: { id: 2, type: 'PreviewImage' }
            }
          ]
        }
      }
    }
  ]
} as const

describe('exportAgentConversation', () => {
  it('interleaves only durably applied backend ops before the terminal frame', () => {
    const conversation = exportAgentConversation(capture)

    expect(conversation.source).toMatchObject({
      response_side: 'recorded',
      capture: capture.capture
    })
    expect(conversation.response).toEqual([
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
        ops: [capture.tool_calls[0].result.data.ops[0]]
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

  it('refuses an add_node whose node payload is missing', () => {
    expect(() =>
      exportAgentConversation({
        ...capture,
        tool_calls: [
          {
            ...capture.tool_calls[0],
            result: {
              data: {
                ops: [{ op: 'add_node', op_id: 'op-accepted', node_id: 1 }]
              }
            }
          }
        ]
      })
    ).toThrow('malformed graph operation')
  })

  it('refuses an accepted op missing from the recorded result', () => {
    expect(() =>
      exportAgentConversation({
        ...capture,
        tool_calls: [
          {
            ...capture.tool_calls[0],
            applied_op_ids: ['op-not-in-result']
          }
        ]
      })
    ).toThrow('accepted op op-not-in-result')
  })

  it('refuses to silently omit a mutating backend call', () => {
    expect(() =>
      exportAgentConversation({ ...capture, frames: [capture.frames[0]] })
    ).toThrow('no terminal websocket frame for tool call(s): tool-1')
  })

  it('refuses a websocket frame from another turn', () => {
    expect(() =>
      exportAgentConversation({
        ...capture,
        frames: [
          {
            ...capture.frames[0],
            data: { ...capture.frames[0].data, message_id: 'another-message' }
          }
        ]
      })
    ).toThrow('does not belong to capture thread-1/message-1')
  })

  it('refuses a captured call with no terminal frame even when nothing applied', () => {
    expect(() =>
      exportAgentConversation({
        ...capture,
        frames: [capture.frames[0]],
        tool_calls: [{ ...capture.tool_calls[0], applied_op_ids: [] }]
      })
    ).toThrow('no terminal websocket frame for tool call(s): tool-1')
  })

  it('refuses a capture that repeats a tool call id', () => {
    expect(() =>
      exportAgentConversation({
        ...capture,
        tool_calls: [
          { ...capture.tool_calls[0], applied_op_ids: [] },
          capture.tool_calls[0]
        ]
      })
    ).toThrow('repeats tool call tool-1')
  })

  it('inserts the accepted batch once when a call reports two terminal frames', () => {
    const conversation = exportAgentConversation({
      ...capture,
      frames: [
        capture.frames[0],
        {
          ...capture.frames[1],
          data: { ...capture.frames[1].data, status: 'error' }
        },
        capture.frames[1]
      ]
    })

    expect(
      conversation.response.filter((entry) => entry.kind === 'graph_ops')
    ).toHaveLength(1)
  })

  it('does not treat an unrecognized tool-call status as terminal', () => {
    expect(() =>
      exportAgentConversation({
        ...capture,
        frames: [
          capture.frames[0],
          {
            ...capture.frames[1],
            data: { ...capture.frames[1].data, status: 'queued' }
          }
        ]
      })
    ).toThrow('no terminal websocket frame for tool call(s): tool-1')
  })

  it('refuses accepted ops whose recorded result carries no operation payload', () => {
    expect(() =>
      exportAgentConversation({
        ...capture,
        tool_calls: [{ ...capture.tool_calls[0], result: { data: [] } }]
      })
    ).toThrow('tool call tool-1 accepted 1 op(s)')
  })

  it('accepts a frame that omits the optional turn identity', () => {
    const conversation = exportAgentConversation({
      ...capture,
      frames: [
        ...capture.frames,
        { type: 'agent_active_tab', data: { workflow_id: 'wf-1', name: 'Tab' } }
      ]
    })

    expect(conversation.response.at(-1)).toEqual({
      kind: 'event',
      event: {
        type: 'agent_active_tab',
        data: { workflow_id: 'wf-1', name: 'Tab' }
      }
    })
  })

  it('refuses to load a fixture whose add_node has no node payload', () => {
    const conversation = exportAgentConversation(capture)

    expect(() =>
      zAgentConversation.parse({
        ...conversation,
        response: [
          {
            kind: 'graph_ops',
            ops: [{ op: 'add_node', op_id: 'op-accepted', node_id: 1 }]
          }
        ]
      })
    ).toThrow()
  })

  it('refuses a recorded label without backend provenance', () => {
    const conversation = exportAgentConversation(capture)
    const { capture: _capture, ...source } = conversation.source

    expect(() => zAgentConversation.parse({ ...conversation, source })).toThrow(
      'recorded responses require backend capture provenance'
    )
  })
})
