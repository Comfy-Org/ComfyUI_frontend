import { describe, expect, it, vi } from 'vitest'

import type { AgentMessages } from '../../schemas/agentApiSchema'
import { toTurnId, zAgentWsEvent } from '../../schemas/agentApiSchema'
import { normalizeAgentTranscript } from './agentTranscript'

import { STALE_AFTER_MS } from '../../crdt/agentCrdtDocLifecycle'
import type { AgentChatEvent } from './agentEventTransport'
import { createAgentEventTransport } from './agentEventTransport'
import type {
  AssistantMessage,
  TextPart,
  ThinkingPart,
  ToolPart
} from './agentMessageParts'
import { createAssistantMessage } from './agentMessageParts'

const fixtureText = import.meta.glob(
  '../../schemas/__fixtures__/agent/*.jsonl',
  { query: '?raw', import: 'default', eager: true }
)

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
    if (event.data.message_id !== messageId) continue
    events.push(event)
  }
  return events
}

const T = toTurnId('t1')

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

function toolCall(
  tool_name: string,
  status: 'running' | 'success' | 'error',
  tool_call_id = `call-${tool_name}`,
  correlation?: { workflow_id: string; op_ids: string[] }
): AgentChatEvent {
  return {
    type: 'agent_tool_call',
    data: {
      tool_call_id,
      tool_name,
      status,
      message_id: 'm',
      thread_id: 't',
      ...correlation
    }
  }
}

function delta(text: string): AgentChatEvent {
  return {
    type: 'agent_message_delta',
    data: { delta: text, message_id: 'm', thread_id: 't' }
  }
}

function draft(text: string): AgentChatEvent {
  return zAgentWsEvent.parse({
    type: 'agent_message_draft',
    data: { text, message_id: 'm', thread_id: 't' }
  })
}

function activeTab(
  workflow_id: string,
  name?: string,
  node_locator_id?: string
): AgentChatEvent {
  return {
    type: 'agent_active_tab',
    data: {
      workflow_id,
      name,
      node_locator_id,
      message_id: 'm',
      thread_id: 't'
    }
  }
}

function runApproval(askId = 'turn-1:call-1'): AgentChatEvent {
  return zAgentWsEvent.parse({
    type: 'agent_ask',
    data: {
      thread_id: 't',
      message_id: 'm',
      ask_id: askId,
      kind: 'run_approval',
      context: {
        workflow_id: 'workflow-1',
        workflow_name: 'Portrait workflow'
      },
      prompt: 'Run workflow “Portrait workflow”?',
      options: [
        { id: 'run', label: 'Run' },
        { id: 'cancel', label: 'Cancel' }
      ],
      min_selections: 1,
      max_selections: 1,
      allow_other: false
    }
  })
}

function askResolved(askId = 'turn-1:call-1'): AgentChatEvent {
  return zAgentWsEvent.parse({
    type: 'agent_ask_resolved',
    data: {
      thread_id: 't',
      message_id: 'm',
      ask_id: askId,
      status: 'answered',
      selected: ['run']
    }
  })
}

const parts = (m: AssistantMessage) => m.parts
const toolParts = (m: AssistantMessage): ToolPart[] =>
  m.parts.filter((p): p is ToolPart => p.type === 'tool')
const textParts = (m: AssistantMessage): TextPart[] =>
  m.parts.filter((p): p is TextPart => p.type === 'text')
const thinkingParts = (m: AssistantMessage): ThinkingPart[] =>
  m.parts.filter((p): p is ThinkingPart => p.type === 'thinking')

describe('agentEventTransport fixture replay', () => {
  it('ws-turn-edit: four settled tools then the reply text', () => {
    const events = chatEventsFor(
      'ws-turn-edit.jsonl',
      '172a6ede-7ab7-4b01-83b6-5b15f66dee4b'
    )
    const replyText = events
      .filter((e) => e.type === 'agent_message_delta')
      .map((e) => e.data.delta)
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

describe('agentEventTransport reply draft replay', () => {
  // Recorded on a preview environment (Comfy-Org/cloud#10351): one narration
  // round, then the resumed wait_for_job and the reply streaming as drafts.
  const events = chatEventsFor(
    'ws-turn-reply-drafts.jsonl',
    '3d3cdb02-8d48-4fdc-8ab1-d8c18b07772e'
  )
  const drafts = events.filter(
    (e): e is Extract<AgentChatEvent, { type: 'agent_message_draft' }> =>
      e.type === 'agent_message_draft'
  )
  const finals = events.filter(
    (e): e is Extract<AgentChatEvent, { type: 'agent_message_delta' }> =>
      e.type === 'agent_message_delta'
  )

  it('shows the reply as it streams, with the narration draft already gone', () => {
    const lastDraft = drafts.at(-1)
    if (!lastDraft) throw new Error('the recording holds no drafts')
    const message = drive(events.slice(0, events.indexOf(lastDraft) + 1))

    expect(drafts.length).toBeGreaterThan(1)
    expect(textParts(message).map((p) => p.text)).toEqual([lastDraft.data.text])
    // What streamed is the start of the answer the turn delivered.
    expect(finals[0].data.delta.startsWith(lastDraft.data.text)).toBe(true)
  })

  it('settles on the final answer alone', () => {
    const message = drive(events)

    expect(finals).toHaveLength(1)
    expect(textParts(message).map((p) => p.text)).toEqual([
      finals[0].data.delta
    ])
    expect(message.streaming).toBe(false)
  })
})

describe('agentEventTransport thinking chip', () => {
  it('thinking before any text opens a retained activity part', () => {
    const message = drive([thinking('planning')])
    expect(message.thinking).toBe(true)
    expect(thinkingParts(message)).toEqual([
      { type: 'thinking', text: 'planning', state: 'streaming' }
    ])
  })

  it('thinking after prior text and tools reopens the status', () => {
    const message = drive([
      delta('before'),
      toolCall('run', 'success'),
      delta('after'),
      thinking('Planning the next step')
    ])

    expect(message.parts.map((part) => part.type)).toEqual([
      'text',
      'tool',
      'text',
      'thinking'
    ])
    expect(message.thinking).toBe(true)
    expect(message.thinkingText).toBe('Planning the next step')
  })
})

describe('agentEventTransport thinking narration', () => {
  it('thinking deltas accumulate into thinkingText on the snapshot', () => {
    const message = drive([thinking('Reading '), thinking('the graph')])
    expect(message.thinkingText).toBe('Reading the graph')
    expect(thinkingParts(message)).toEqual([
      { type: 'thinking', text: 'Reading the graph', state: 'streaming' }
    ])
  })

  it('a tool call clears the live narration but retains the completed step', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2300)
    const message = drive([
      thinking('Adding a node'),
      toolCall('add_node', 'success')
    ])
    expect(message.thinkingText).toBeUndefined()
    expect(thinkingParts(message)).toEqual([
      {
        type: 'thinking',
        text: 'Adding a node',
        state: 'done',
        durationMs: 1300
      }
    ])
  })

  it('a tool call after thinking clears the thinking status', () => {
    const message = drive([
      thinking('Adding a node'),
      toolCall('add_node', 'success')
    ])
    expect(message.thinking).toBe(false)
  })

  it('the first text delta clears the live narration but retains the step', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const message = drive([thinking('Writing a reply'), delta('Here')])
    expect(message.thinkingText).toBeUndefined()
    expect(thinkingParts(message)).toEqual([
      { type: 'thinking', text: 'Writing a reply', state: 'done' }
    ])
  })

  it('settle clears the live narration but retains the completed step', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit)
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    transport.ingest(thinking('Wrapping up'))
    transport.settle()
    const final = emit.mock.calls.at(-1)?.[0] ?? message
    expect(final.thinkingText).toBeUndefined()
    expect(thinkingParts(final)).toEqual([
      { type: 'thinking', text: 'Wrapping up', state: 'done' }
    ])
  })

  it('each emit is a distinct snapshot whose parts array ignores later events', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit)

    transport.ingest(thinking('First'))
    const first = emit.mock.calls.at(-1)![0]
    const firstPartsLength = first.parts.length
    transport.ingest(toolCall('add_node', 'success'))
    const second = emit.mock.calls.at(-1)![0]

    expect(second).not.toBe(first)
    expect(second.parts).not.toBe(first.parts)
    expect(first.parts).toHaveLength(firstPartsLength)
    expect(first.parts[0]).toEqual({
      type: 'thinking',
      text: 'First',
      state: 'streaming'
    })
  })

  it('retains alternating reasoning and tool events in transcript order', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const message = drive([
      thinking('Inspecting the graph'),
      toolCall('list_slots', 'success'),
      thinking('Applying the edit'),
      toolCall('set_widget', 'success')
    ])
    expect(message.parts).toEqual([
      {
        type: 'thinking',
        text: 'Inspecting the graph',
        state: 'done'
      },
      expect.objectContaining({ type: 'tool', name: 'list_slots' }),
      { type: 'thinking', text: 'Applying the edit', state: 'done' },
      expect.objectContaining({ type: 'tool', name: 'set_widget' })
    ])
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
      toolCall('run', 'success'),
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

  it('folds running and success frames into one tool lifecycle', () => {
    const message = drive([
      toolCall('run', 'running', 'call-1'),
      toolCall('run', 'success', 'call-1')
    ])

    expect(toolParts(message)).toEqual([
      {
        type: 'tool',
        callId: 'call-1',
        name: 'run',
        state: 'done',
        ok: true,
        durationMs: undefined
      }
    ])
  })

  it('updates an already-restored tool part in place instead of duplicating it', () => {
    const restored: ToolPart = {
      type: 'tool',
      callId: 'call-1',
      name: 'run',
      state: 'streaming'
    }
    const message = createAssistantMessage(T)
    message.parts = [restored]
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit)

    transport.ingest(toolCall('run', 'success', 'call-1'))

    expect(toolParts(message)).toEqual([
      {
        type: 'tool',
        callId: 'call-1',
        name: 'run',
        state: 'done',
        ok: true,
        durationMs: undefined
      }
    ])
  })

  it('updates a persisted-then-restored tool part in place when a live frame carries a different id than the audit row', () => {
    // The audit row's own id and the provider tool_call_id it was recorded
    // under are deliberately DIFFERENT here (unlike 'call-1' reused for
    // both elsewhere in this file) so this test actually exercises the
    // mismatch: a live agent_tool_call frame keys on tool_call_id, not the
    // audit row's id, so callId must be derived from tool_call_id or the
    // restored part and the live update never match.
    const persistedRow: AgentMessages[number] = {
      id: 'row-1',
      thread_id: 'thread-1',
      seq: 1,
      role: 'assistant',
      status: 'complete',
      turn_id: 't1',
      content: {
        text: '',
        tool_calls: [
          {
            id: 'audit-row-uuid-1',
            tool_call_id: 'call-1',
            tool_name: 'run',
            status: 'running'
          }
        ]
      }
    }
    const { messages } = normalizeAgentTranscript([persistedRow])
    const message = messages[0]
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit)

    transport.ingest(toolCall('run', 'success', 'call-1'))

    expect(toolParts(message)).toEqual([
      {
        type: 'tool',
        callId: 'call-1',
        name: 'run',
        state: 'done',
        ok: true,
        durationMs: undefined
      }
    ])
  })
})

describe('agentEventTransport run approval', () => {
  it('places the approval card at the decision point in transcript order', () => {
    const message = drive([
      delta('before'),
      runApproval(),
      delta('after the decision')
    ])

    expect(message.parts).toEqual([
      { type: 'text', text: 'before', state: 'done' },
      {
        type: 'runApproval',
        askId: 'turn-1:call-1',
        workflowId: 'workflow-1',
        workflowName: 'Portrait workflow'
      },
      { type: 'text', text: 'after the decision', state: 'streaming' }
    ])
  })

  it('removes only the matching approval when the ask resolves', () => {
    const message = drive([
      runApproval('ask-1'),
      runApproval('ask-2'),
      askResolved('ask-1')
    ])

    expect(
      message.parts.flatMap((part) =>
        (part as { type: string }).type === 'runApproval'
          ? [(part as { askId: string }).askId]
          : []
      )
    ).toEqual(['ask-2'])
    expect(message.streaming).toBe(true)
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
    transport.ingest(toolCall('late_tool', 'success'))

    expect(emit.mock.calls.length).toBe(callsAfterSettle)
    expect(textParts(message)[0]).toMatchObject({
      text: 'final',
      state: 'done'
    })
    expect(toolParts(message)).toHaveLength(0)
  })

  it('records an explicitly targeted node link when the agent switches workflow tabs', () => {
    const message = drive([
      delta('opening it now'),
      activeTab('wf-1', 'Portrait upscale', 'root-a:42'),
      delta('and here it is')
    ])

    // The link closes the open text part, so prose streamed after it starts a
    // new part below the card instead of being absorbed by the one above.
    expect(parts(message).map((part) => part.type)).toEqual([
      'text',
      'tabLink',
      'text'
    ])
    expect(parts(message)[1]).toEqual({
      type: 'tabLink',
      workflowId: 'wf-1',
      locatorId: 'root-a:42',
      name: 'Portrait upscale'
    })
  })

  it('closes thinking before recording a tab switch', () => {
    const message = drive([
      thinking('opening the workflow'),
      activeTab('wf-1', 'Portrait upscale'),
      thinking('checking its nodes')
    ])

    expect(parts(message).map((part) => part.type)).toEqual([
      'thinking',
      'tabLink',
      'thinking'
    ])
    expect(thinkingParts(message)).toEqual([
      {
        type: 'thinking',
        text: 'opening the workflow',
        state: 'done'
      },
      {
        type: 'thinking',
        text: 'checking its nodes',
        state: 'streaming'
      }
    ])
    expect(message.thinkingText).toBe('checking its nodes')
  })

  it('links a tab once even when the agent keeps working between announcements', () => {
    const message = drive([
      activeTab('wf-1', 'First'),
      delta('adding the nodes'),
      toolCall('add_node', 'success'),
      activeTab('wf-1', 'First')
    ])

    expect(
      parts(message).flatMap((part) =>
        part.type === 'tabLink' ? [part.workflowId] : []
      )
    ).toEqual(['wf-1'])
  })

  it('links distinct node targets within the same workflow', () => {
    const message = drive([
      activeTab('wf-1', 'First node', 'root-a:1'),
      activeTab('wf-1', 'Second node', 'root-a:2'),
      activeTab('wf-1', 'Second node', 'root-a:2')
    ])

    expect(
      parts(message).flatMap((part) =>
        part.type === 'tabLink' ? [part.locatorId] : []
      )
    ).toEqual(['root-a:1', 'root-a:2'])
  })

  it('links a tab again when the agent returns to it after switching away', () => {
    const message = drive([
      activeTab('wf-1', 'First'),
      activeTab('wf-1', 'First'),
      activeTab('wf-2', 'Second'),
      activeTab('wf-1', 'First')
    ])

    expect(
      parts(message).flatMap((part) =>
        part.type === 'tabLink' ? [part.workflowId] : []
      )
    ).toEqual(['wf-1', 'wf-2', 'wf-1'])
  })
})

describe('agentEventTransport reply drafts', () => {
  it('shows the answer while the model is still writing it', () => {
    const message = drive([
      toolCall('wait_for_job', 'success'),
      draft('Here is'),
      draft('Here is your video')
    ])

    expect(textParts(message)).toEqual([
      { type: 'text', text: 'Here is your video', state: 'streaming' }
    ])
  })

  it('replaces the draft with the answer instead of appending to it', () => {
    const message = drive([draft('Here is your'), delta('Here is your video.')])

    expect(textParts(message).map((p) => p.text)).toEqual([
      'Here is your video.'
    ])
  })

  it('moves narration out of the reply once the round turns out to be one', () => {
    const message = drive([
      draft('Let me check the'),
      thinking('Let me check the widgets first'),
      toolCall('set_widget', 'running')
    ])

    expect(textParts(message)).toEqual([])
    expect(thinkingParts(message).map((p) => p.text)).toEqual([
      'Let me check the widgets first'
    ])
  })

  it('keeps the answer on screen through the reasoning frame that precedes it', () => {
    const message = drive([
      draft('Here is your'),
      thinking('the render finished cleanly')
    ])

    expect(textParts(message).map((p) => p.text)).toEqual(['Here is your'])
  })

  it("drops the draft at the round's first tool call", () => {
    const message = drive([draft('One moment'), toolCall('run', 'running')])

    expect(textParts(message)).toEqual([])
    expect(toolParts(message).map((p) => p.name)).toEqual(['run'])
  })

  it('drops the draft when the round stops for run approval', () => {
    const message = drive([
      draft('Validates clean and ready to run.'),
      thinking('Validates clean and ready to run. Generating now.'),
      runApproval()
    ])

    expect(textParts(message)).toEqual([])
    expect(parts(message).map((p) => p.type)).toEqual([
      'thinking',
      'runApproval'
    ])
  })

  it('withdraws the draft on an empty one, as a retried round sends', () => {
    const message = drive([draft('half an'), draft(''), draft('the whole')])

    expect(textParts(message).map((p) => p.text)).toEqual(['the whole'])
  })

  it('never leaves a provisional answer behind when the turn settles', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit)
    transport.ingest(draft('Here is your'))
    transport.settle()

    expect(textParts(emit.mock.calls.at(-1)?.[0] ?? message)).toEqual([])
  })

  it('keeps the reply text of earlier rounds when a later round drafts', () => {
    const message = drive([
      delta('First, the plan.'),
      toolCall('run', 'success'),
      draft('And now the')
    ])

    expect(textParts(message).map((p) => p.text)).toEqual([
      'First, the plan.',
      'And now the'
    ])
  })
})

describe('agentEventTransport canvas-sync gate (PM-1575)', () => {
  it('settles a correlated tool call only after the matching workflow applies every expected operation', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit, () => true)

    transport.ingest(
      toolCall('future_mutating_tool', 'success', 'call-1', {
        workflow_id: 'workflow-1',
        op_ids: ['op-1', 'op-2']
      })
    )
    expect(toolParts(message)[0]).toMatchObject({ state: 'streaming' })

    transport.notifyCanvasCaughtUp({
      workflowId: 'workflow-2',
      opIds: ['op-1', 'op-2']
    })
    transport.notifyCanvasCaughtUp({
      workflowId: 'workflow-1',
      opIds: ['op-1']
    })
    expect(toolParts(message)[0]).toMatchObject({ state: 'streaming' })

    transport.notifyCanvasCaughtUp({
      workflowId: 'workflow-1',
      opIds: ['op-2', 'op-1']
    })
    expect(toolParts(message)[0]).toMatchObject({ state: 'done' })
  })

  it('settles an uncorrelated success immediately while the gate is open', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit, () => true)

    transport.ingest(toolCall('add_node', 'success'))
    expect(toolParts(message)[0]).toMatchObject({
      ok: true,
      state: 'done'
    })
  })

  // A failed tool call never mutates anything, so there is no forthcoming
  // doc_update for it to wait on -- gating it the same as a success would
  // strand it at the spinner glyph until STALE_AFTER_MS (30s), and, for a
  // turn whose other tool calls also never touch the canvas,
  // notifyCanvasCaughtUp may never fire at all to rescue it early.
  it('settles an errored tool call immediately, even while the gate is open', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit, () => true)

    transport.ingest(
      toolCall('validate', 'error', 'call-validate', {
        workflow_id: 'workflow-1',
        op_ids: ['op-1']
      })
    )

    expect(toolParts(message)[0]).toMatchObject({ ok: false, state: 'done' })
  })

  it('does not defer when the gate is closed', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit, () => false)

    transport.ingest(
      toolCall('add_node', 'success', 'call-add_node', {
        workflow_id: 'workflow-1',
        op_ids: ['op-1']
      })
    )

    expect(toolParts(message)[0]).toMatchObject({ ok: true, state: 'done' })
  })

  // The normal ordering can be doc_update first and terminal tool frame
  // second. Retaining correlated applied frames prevents that race.
  it('settles immediately when the matching doc_update already applied before the terminal frame arrives', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit, () => true)

    transport.ingest(
      toolCall('add_node', 'running', 'call-add_node', {
        workflow_id: 'workflow-1',
        op_ids: ['op-1']
      })
    )
    transport.notifyCanvasCaughtUp({
      workflowId: 'workflow-1',
      opIds: ['op-1']
    })
    transport.ingest(
      toolCall('add_node', 'success', 'call-add_node', {
        workflow_id: 'workflow-1',
        op_ids: ['op-1']
      })
    )

    expect(toolParts(message)[0]).toMatchObject({ ok: true, state: 'done' })
  })

  // PM-1575 regression (finding #6, medium): a duplicate or redelivered
  // terminal frame for the same tool_call_id (e.g. a websocket retry) used
  // to overwrite the pending timer's map entry without clearing the
  // previous handle, leaving it to fire at the ORIGINAL, now-stale deadline
  // and settle the part early against the newer timer's own bookkeeping.
  it('does not settle early from an orphaned timer left by a redelivered terminal frame', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit, () => true)

    const terminal = toolCall('add_node', 'success', 'call-1', {
      workflow_id: 'workflow-1',
      op_ids: ['op-1']
    })
    transport.ingest(terminal)
    expect(toolParts(message)[0]).toMatchObject({ state: 'streaming' })

    vi.advanceTimersByTime(15_000)
    transport.ingest(terminal)

    vi.advanceTimersByTime(15_000)
    expect(toolParts(message)[0]).toMatchObject({ state: 'streaming' })

    vi.advanceTimersByTime(15_000)
    expect(toolParts(message)[0]).toMatchObject({ state: 'done' })
  })

  it('hasPendingCanvasSync reflects whether a tool call is held back', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit, () => true)

    expect(transport.hasPendingCanvasSync()).toBe(false)
    transport.ingest(
      toolCall('add_node', 'success', 'call-add_node', {
        workflow_id: 'workflow-1',
        op_ids: ['op-1']
      })
    )
    expect(transport.hasPendingCanvasSync()).toBe(true)
    transport.notifyCanvasCaughtUp({
      workflowId: 'workflow-1',
      opIds: ['op-1']
    })
    expect(transport.hasPendingCanvasSync()).toBe(false)
  })

  // PM-1575 (findings #4/#5): a transport torn down for a reason other than
  // natural completion (abort, drop, reset, hydrate) must flush anything it
  // is still holding and cancel its timers, rather than leaving a part
  // stranded at 'streaming' or an orphaned timer that can fire later against
  // a message object the store has since discarded or replaced.
  it('dispose flushes held parts to done and cancels their timers', () => {
    const message = createAssistantMessage(T)
    const emit = vi.fn<(m: AssistantMessage) => void>()
    const transport = createAgentEventTransport(message, emit, () => true)

    transport.ingest(
      toolCall('add_node', 'success', 'call-add_node', {
        workflow_id: 'workflow-1',
        op_ids: ['op-1']
      })
    )
    expect(toolParts(message)[0]).toMatchObject({ state: 'streaming' })

    transport.dispose()
    expect(toolParts(message)[0]).toMatchObject({ state: 'done' })
    expect(transport.hasPendingCanvasSync()).toBe(false)

    const callsAfterDispose = emit.mock.calls.length
    vi.advanceTimersByTime(STALE_AFTER_MS)
    expect(emit.mock.calls.length).toBe(callsAfterDispose)
  })
})
