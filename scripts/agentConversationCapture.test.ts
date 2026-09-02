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
            { op: 'add_node', op_id: 'op-accepted', node_id: 1 },
            { op: 'add_node', op_id: 'op-rejected', node_id: 2 }
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

  it('refuses a recorded label without backend provenance', () => {
    const conversation = exportAgentConversation(capture)
    const { capture: _capture, ...source } = conversation.source

    expect(() => zAgentConversation.parse({ ...conversation, source })).toThrow(
      'recorded responses require backend capture provenance'
    )
  })
})
