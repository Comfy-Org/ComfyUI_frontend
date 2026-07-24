import { describe, expect, it } from 'vitest'

import {
  AGENT_WS_EVENT_TYPES,
  isAgentEvent,
  parseAgentWsEvent,
  zAgentCancelAccepted,
  zAgentDraftSnapshot,
  zAgentError,
  zAgentMessage,
  zAgentMessages,
  zAgentTurnAccepted,
  zAgentWsEvent
} from './agentApiSchema'
import type { ZodTypeAny } from 'zod'

const fixtureText = import.meta.glob('./__fixtures__/agent/*.jsonl', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

function jsonlLines(path: string): unknown[] {
  return fixtureText[path]
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown)
}

const wsPaths = Object.keys(fixtureText).filter((path) => path.includes('/ws-'))
const restPath = './__fixtures__/agent/rest-responses.jsonl'

interface WsLine {
  frame: { type: string }
}

interface RestLine {
  op: string
  status: number
  body: unknown
}

describe('agentApiSchema fixture gate', () => {
  describe('ws frames: every line is a valid agent event or a recognized-foreign frame', () => {
    it.for(wsPaths)('%s', (path) => {
      const lines = jsonlLines(path) as WsLine[]
      lines.forEach((line, index) => {
        const { frame } = line
        if (isAgentEvent(frame.type)) {
          const result = zAgentWsEvent.safeParse(frame)
          if (!result.success) {
            throw new Error(
              `${path} line ${index} (${frame.type}) failed: ${result.error.message}`
            )
          }
        } else {
          expect(
            zAgentWsEvent.safeParse(frame).success,
            `${path} line ${index} (${frame.type}) must stay foreign to the agent union`
          ).toBe(false)
        }
      })
    })
  })

  describe('rest responses: each line parses through its op/status schema', () => {
    const restLines = jsonlLines(restPath) as RestLine[]

    it.for(restLines.map((line, index) => [index, line] as const))(
      'line %i',
      ([index, line]) => {
        const schema = restSchemaFor(line)
        const result = schema.safeParse(line.body)
        if (!result.success) {
          throw new Error(
            `rest line ${index} (op=${line.op} status=${line.status}) failed: ${result.error.message}`
          )
        }
      }
    )
  })
})

function restSchemaFor(line: RestLine): ZodTypeAny {
  if (line.status >= 400) return zAgentError
  if (line.op.startsWith('postMessage')) return zAgentTurnAccepted
  if (line.op.startsWith('getMessages')) return zAgentMessages
  if (line.op.startsWith('getDraft')) return zAgentDraftSnapshot
  if (line.op.startsWith('cancelMessage')) return zAgentCancelAccepted
  throw new Error(`no schema mapped for op=${line.op} status=${line.status}`)
}

describe('agentApiSchema contract subtleties', () => {
  const doneBase = {
    type: 'agent_message_done',
    data: { message_id: 'm1', thread_id: 't1' }
  }

  it('accepts agent_message_done with usage null (cancelled turn)', () => {
    expect(
      zAgentWsEvent.safeParse({
        ...doneBase,
        data: { ...doneBase.data, usage: null }
      }).success
    ).toBe(true)
  })

  it('accepts agent_message_done usage whether fully populated or partial', () => {
    const usages = [
      {
        input_tokens: 4493,
        output_tokens: 425,
        total_tokens: 4918,
        cache_read_input_tokens: 35596,
        cache_creation_input_tokens: 0
      },
      { input_tokens: 1, output_tokens: 2 },
      {}
    ]

    for (const usage of usages) {
      const parsed = zAgentWsEvent.parse({
        ...doneBase,
        data: { ...doneBase.data, usage }
      })

      if (parsed.type !== 'agent_message_done') throw new Error('wrong variant')
      expect(parsed.data.usage).toEqual(usage)
    }
  })

  it('degrades a malformed usage instead of failing the done frame', () => {
    for (const usage of ['nope', 42, { input_tokens: '4493' }]) {
      const parsed = zAgentWsEvent.parse({
        ...doneBase,
        data: { ...doneBase.data, usage }
      })

      if (parsed.type !== 'agent_message_done') throw new Error('wrong variant')
      expect(parsed.data.usage).toBeUndefined()
    }
  })

  it('rejects draft_patch missing base_version', () => {
    expect(
      zAgentWsEvent.safeParse({
        type: 'draft_patch',
        data: { version: 2, content: {}, workflow_id: 'w1' }
      }).success
    ).toBe(false)
  })

  it('rejects an unknown event type in the union while isAgentEvent stays false', () => {
    expect(zAgentWsEvent.safeParse({ type: 'status', data: {} }).success).toBe(
      false
    )
    expect(isAgentEvent('status')).toBe(false)
  })

  it('accepts extra additive keys in event data', () => {
    const parsed = parseAgentWsEvent({
      type: 'draft_version',
      data: { version: 5, workflow_id: 'w1', future_field: true }
    })
    expect(parsed.success).toBe(true)
  })

  it('exposes exactly the seven agent event types', () => {
    expect([...AGENT_WS_EVENT_TYPES].sort()).toEqual(
      [
        'agent_active_tab',
        'agent_message_delta',
        'agent_message_done',
        'agent_thinking',
        'agent_tool_call',
        'draft_patch',
        'draft_version'
      ].sort()
    )
  })

  it('parses agent_active_tab with an optional name and rejects a missing workflow_id', () => {
    const parsed = zAgentWsEvent.safeParse({
      type: 'agent_active_tab',
      data: { workflow_id: 'wf-1', thread_id: 'th-1' }
    })
    expect(parsed.success).toBe(true)
    expect(
      zAgentWsEvent.safeParse({
        type: 'agent_active_tab',
        data: { thread_id: 'th-1' }
      }).success
    ).toBe(false)
  })

  it('accepts an AgentMessage with status interrupted', () => {
    expect(
      zAgentMessage.safeParse({
        id: 'm1',
        thread_id: 't1',
        seq: 3,
        role: 'assistant',
        status: 'interrupted',
        turn_id: 'x1'
      }).success
    ).toBe(true)
  })

  it('accepts an AgentMessage with content omitted', () => {
    expect(
      zAgentMessage.safeParse({
        id: 'm1',
        thread_id: 't1',
        seq: 0,
        role: 'user',
        status: 'complete',
        turn_id: 'x1'
      }).success
    ).toBe(true)
  })
})
