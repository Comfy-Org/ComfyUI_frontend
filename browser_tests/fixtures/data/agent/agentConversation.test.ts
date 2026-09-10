import { describe, expect, it } from 'vitest'

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  assertOpsApply,
  zAgentConversation,
  zRecordedWsEvent
} from '@e2e/fixtures/data/agent/agentConversation'
import { RECORDED_EXPECTATIONS } from '@e2e/fixtures/data/agent/agentConversationExpectations'
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

  it('refuses a cancel placed at or after the done entry', () => {
    expect(() =>
      zAgentConversation.parse({
        ...recorded,
        turns: [{ ...recorded.turns[0], cancel_after: 0 }]
      })
    ).toThrow('cancel_after must precede the final agent_message_done entry')
  })

  it('refuses a turn that carries content after its done event', () => {
    expect(() =>
      zAgentConversation.parse({
        ...recorded,
        turns: [
          {
            ...recorded.turns[0],
            response: [
              {
                kind: 'event',
                event: { type: 'agent_message_done', data: {} }
              },
              {
                kind: 'event',
                event: { type: 'agent_thinking', data: { delta: 'x' } }
              }
            ]
          }
        ]
      })
    ).toThrow('exactly one agent_message_done event, as its last entry')
  })

  it('refuses a recorded label without backend provenance', () => {
    const { capture: _capture, ...source } = recorded.source
    expect(() => zAgentConversation.parse({ ...recorded, source })).toThrow(
      'recorded responses require backend capture provenance'
    )
  })

  it('refuses a turn with two completion events', () => {
    const done = {
      kind: 'event',
      event: { type: 'agent_message_done', data: {} }
    }
    const tab = {
      kind: 'event',
      event: {
        type: 'agent_active_tab',
        data: { workflow_id: recorded.workflow.id, name: 'Captured workflow' }
      }
    }
    const turn = { ...recorded.turns[0], response: [tab, done, tab, done] }
    expect(() =>
      zAgentConversation.parse({ ...recorded, turns: [turn] })
    ).toThrow('exactly one agent_message_done')
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

describe('committed recordings', () => {
  // import.meta.url is not a file URL under vitest, so the loaders are bypassed.
  const dir = join(
    process.cwd(),
    'browser_tests/fixtures/data/agent/conversations'
  )
  const files = readdirSync(dir).filter((file) => file.endsWith('.json'))
  const load = (file: string): unknown =>
    JSON.parse(readFileSync(join(dir, file), 'utf8'))

  it('every recording parses against the production event union', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const raw = load(file)
      const conversation = zAgentConversation.parse(raw)
      expect(() => assertOpsApply(conversation), file).not.toThrow()
      expect({ file, workflow: conversation.workflow }).toEqual({
        file,
        workflow: (raw as { workflow: unknown }).workflow
      })
      const frames = conversation.turns
        .flatMap((turn) => turn.response)
        .filter((entry) => entry.kind === 'event')
      expect({ file, frames: frames.length }).not.toEqual({ file, frames: 0 })
    }
  })

  it('every recording has explicit visible expectations for each turn', () => {
    const turns = Object.fromEntries(
      files.map((file) => [
        file.slice(0, -'.json'.length),
        zAgentConversation.parse(load(file)).turns.length
      ])
    )
    expect(
      Object.fromEntries(
        Object.entries(RECORDED_EXPECTATIONS).map(([caseId, expected]) => [
          caseId,
          expected?.length ?? 0
        ])
      )
    ).toEqual(turns)
  })

  it('the cancelled recording stops with text still to render', () => {
    const conversation = zAgentConversation.parse(
      load('agent-rec-cancelled-turn.json')
    )
    const [turn] = conversation.turns
    expect(turn.cancel_after).toBeDefined()
    expect(
      turn.response.some(
        (entry) =>
          entry.kind === 'event' &&
          entry.event.type === 'agent_message_delta' &&
          entry.event.data.delta.length > 0
      )
    ).toBe(true)
  })

  it('refuses a set_widget whose value never reaches the document', () => {
    const raw = load('agent-rec-set-widget-existing.json') as {
      turns: Array<{
        response: Array<{ kind: string; ops?: Array<Record<string, unknown>> }>
      }>
    }
    const write = raw.turns[0].response
      .flatMap((entry) => entry.ops ?? [])
      .find((op) => op.op === 'set_widget')!
    delete write.value
    expect(() => assertOpsApply(zAgentConversation.parse(raw))).toThrow(
      /carries no value at projection\.nodes\[\d+\]\.widgets_values\[\d+\]/
    )
  })
})
