import { describe, expect, it, vi } from 'vitest'

import type { AgentWsEvent, TurnId } from '../../schemas/agentApiSchema'
import { zAgentWsEvent } from '../../schemas/agentApiSchema'

import type { AgentChatEvent } from './agentEventTransport'
import { createAgentEventTransport } from './agentEventTransport'
import type { AssistantMessage, TextPart, ToolPart } from './agentMessageParts'
import { createAssistantMessage } from './agentMessageParts'

const fixtureText = import.meta.glob(
  '../../schemas/__fixtures__/agent/*.jsonl',
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

function fixtureFor(name: string): string {
  const path = Object.keys(fixtureText).find((p) => p.endsWith(`/${name}`))
  if (!path) throw new Error(`fixture not found: ${name}`)
  return fixtureText[path]
}

interface WsLine {
  frame: unknown
}

function chatEventsFor(fixture: string, messageId: string): AgentChatEvent[] {
  const events: AgentChatEvent[] = []
  for (const line of fixtureFor(fixture).split('\n')) {
    if (!line.trim()) continue
    const { frame } = JSON.parse(line) as WsLine
    const parsed = zAgentWsEvent.safeParse(frame)
    if (!parsed.success) continue
    const event = parsed.data
    if (!isChatEvent(event)) continue
    if (event.data.message_id !== messageId) continue
    events.push(event)
  }
  return events
}

function isChatEvent(event: AgentWsEvent): event is AgentChatEvent {
  return (
    event.type === 'agent_thinking' ||
    event.type === 'agent_tool_call' ||
    event.type === 'agent_message_delta' ||
    event.type === 'agent_message_done'
  )
}

const T = 't1' as TurnId

function drive(events: AgentChatEvent[]): AssistantMessage {
  const message = createAssistantMessage(T)
  const emit = vi.fn<(m: AssistantMessage) => void>()
  const transport = createAgentEventTransport(message, emit)
  for (const event of events) transport.ingest(event)
  return emit.mock.calls.at(-1)?.[0] ?? message
}

function thinking(delta: string): AgentChatEvent {
  return {
    type: 'agent_thinking',
    data: { delta, message_id: 'm', thread_id: 't' }
  }
}

function toolCall(tool_name: string, status: string): AgentChatEvent {
  return {
    type: 'agent_tool_call',
    data: { tool_name, status, args: [], message_id: 'm', thread_id: 't' }
  }
}

function delta(text: string): AgentChatEvent {
  return {
    type: 'agent_message_delta',
    data: { delta: text, message_id: 'm', thread_id: 't' }
  }
}

const parts = (m: AssistantMessage) => m.parts
const toolParts = (m: AssistantMessage): ToolPart[] =>
  m.parts.filter((p): p is ToolPart => p.type === 'tool')
const textParts = (m: AssistantMessage): TextPart[] =>
  m.parts.filter((p): p is TextPart => p.type === 'text')

describe('agentEventTransport fixture replay', () => {
  it('ws-turn-edit: four settled tools then the reply text', () => {
    const events = chatEventsFor(
      'ws-turn-edit.jsonl',
      '172a6ede-7ab7-4b01-83b6-5b15f66dee4b'
    )
    const replyText = events
      .filter((e) => e.type === 'agent_message_delta')
      .map((e) => (e.type === 'agent_message_delta' ? e.data.delta : ''))
      .join('')

    const message = drive(events)

    expect(
      toolParts(message).map((p) => ({
        name: p.name,
        ok: p.ok,
        state: p.state
      }))
    ).toEqual([
      { name: 'list_slots', ok: true, state: 'done' },
      { name: 'ls_nodes', ok: true, state: 'done' },
      { name: 'set_widget', ok: true, state: 'done' },
      { name: 'set_widget', ok: true, state: 'done' }
    ])
    const texts = textParts(message)
    expect(texts).toHaveLength(1)
    expect(texts[0]).toMatchObject({ text: replyText, state: 'done' })
    expect(parts(message).at(-1)).toBe(texts[0])
    expect(message.streaming).toBe(false)
    expect(message.thinking).toBe(false)
  })

  it('ws-turn-cancelled: one reply text part, settled', () => {
    const events = chatEventsFor(
      'ws-turn-cancelled.jsonl',
      '5d7c81a9-31f5-42f8-81c0-7525473da046'
    )
    const message = drive(events)

    const texts = textParts(message)
    expect(texts).toHaveLength(1)
    expect(texts[0]).toMatchObject({
      text: 'Stopped at your request.',
      state: 'done'
    })
    expect(toolParts(message)).toHaveLength(0)
    expect(message.streaming).toBe(false)
  })
})

describe('agentEventTransport thinking chip', () => {
  it('thinking before any text flips the chip and creates no part', () => {
    const message = drive([thinking('planning')])
    expect(message.thinking).toBe(true)
    expect(message.parts).toHaveLength(0)
  })

  it('thinking after text does not re-flip the chip', () => {
    const message = drive([delta('hello'), thinking('second thought')])
    expect(message.thinking).toBe(false)
  })
})

describe('agentEventTransport text and tool parts', () => {
  it('two deltas append into one text part', () => {
    const message = drive([delta('foo '), delta('bar')])
    const texts = textParts(message)
    expect(texts).toHaveLength(1)
    expect(texts[0].text).toBe('foo bar')
  })

  it('a delta with no prior thinking opens a text part directly', () => {
    const message = drive([delta('hi')])
    expect(textParts(message)).toHaveLength(1)
    expect(textParts(message)[0].text).toBe('hi')
  })

  it('delta -> tool -> delta yields text, tool, text as three parts', () => {
    const message = drive([
      delta('before'),
      toolCall('run', 'ok'),
      delta('after')
    ])
    expect(parts(message).map((p) => p.type)).toEqual(['text', 'tool', 'text'])
    expect(textParts(message).map((p) => p.text)).toEqual(['before', 'after'])
  })

  it('a tool with status error settles ok false, state done', () => {
    const message = drive([toolCall('run', 'error')])
    expect(toolParts(message)[0]).toMatchObject({
      state: 'done',
      ok: false
    })
  })
})

describe('agentEventTransport settle lifecycle', () => {
  it('settle mid-stream closes the open text part and clears streaming', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit)
    transport.ingest(delta('partial'))
    transport.settle()
    const final = emit.mock.calls.at(-1)?.[0] ?? message
    expect(textParts(final)[0]).toMatchObject({
      text: 'partial',
      state: 'done'
    })
    expect(final.streaming).toBe(false)
    expect(final.thinking).toBe(false)
  })

  it('a second settle is a no-op after the first', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit)
    transport.settle()
    const callsAfterFirst = emit.mock.calls.length
    transport.settle()
    expect(emit.mock.calls.length).toBe(callsAfterFirst)
  })

  it('events arriving after settle are ignored', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit)
    transport.ingest(delta('final'))
    transport.settle()
    const callsAfterSettle = emit.mock.calls.length

    transport.ingest(delta(' late'))
    transport.ingest(toolCall('late_tool', 'ok'))

    expect(emit.mock.calls.length).toBe(callsAfterSettle)
    expect(textParts(message)[0]).toMatchObject({
      text: 'final',
      state: 'done'
    })
    expect(toolParts(message)).toHaveLength(0)
  })
})
