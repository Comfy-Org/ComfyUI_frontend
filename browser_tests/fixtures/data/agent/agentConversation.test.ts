import { describe, expect, it } from 'vitest'

import {
  zAgentConversation,
  zRecordedWsEvent
} from '@e2e/fixtures/data/agent/agentConversation'
import { zAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

const recorded = {
  schema_version: 'agent-conversation.v2',
  source: {
    repo: 'Comfy-Org/evals',
    suite: 'agent',
    case_id: 'recorded-case',
    response_side: 'recorded',
    capture: {
      backend: 'Comfy-Org/cloud',
      thread_id: 'thread-1',
      exported_at: '2026-09-02T16:00:00.000Z'
    }
  },
  workflow: {
    id: '6f1c2c1e-3b1c-4c88-9d9c-0d6e9b8e1a01',
    name: 'Captured workflow',
    catalog: { types: {} },
    seed: { nodes: [], links: [] }
  },
  turns: [
    {
      message_id: 'message-1',
      request: { content: 'Add a node' },
      response: [
        { kind: 'event', event: { type: 'agent_message_done', data: {} } }
      ]
    }
  ]
}

describe('zAgentConversation', () => {
  it('accepts a recorded conversation with provenance and message ids', () => {
    expect(zAgentConversation.parse(recorded)).toEqual(recorded)
  })

  it('refuses a recorded turn without the message id it came from', () => {
    const { message_id: _messageId, ...anonymous } = recorded.turns[0]
    expect(() =>
      zAgentConversation.parse({ ...recorded, turns: [anonymous] })
    ).toThrow('recorded turns carry the message id')
  })

  it('refuses a recorded label without backend provenance', () => {
    const { capture: _capture, ...source } = recorded.source
    expect(() => zAgentConversation.parse({ ...recorded, source })).toThrow(
      'recorded responses require backend capture provenance'
    )
  })
})

describe('zRecordedWsEvent', () => {
  const discriminators = (
    union: typeof zAgentWsEvent | typeof zRecordedWsEvent
  ) => union.options.map((option) => option.shape.type.value)

  it('mirrors every production event type', () => {
    expect(discriminators(zRecordedWsEvent)).toEqual(
      discriminators(zAgentWsEvent)
    )
  })

  it('validates the production fields without the ids the replay mints', () => {
    const frame = {
      type: 'agent_tool_call',
      data: {
        tool_call_id: 'toolu_1',
        tool_name: 'apply_ops',
        status: 'success',
        duration_ms: 12
      }
    }
    expect(zRecordedWsEvent.parse(frame)).toEqual(frame)
    expect(() =>
      zRecordedWsEvent.parse({
        ...frame,
        data: { ...frame.data, status: 'done' }
      })
    ).toThrow()
    expect(() =>
      zRecordedWsEvent.parse({ type: 'agent_done', data: {} })
    ).toThrow()
  })
})
