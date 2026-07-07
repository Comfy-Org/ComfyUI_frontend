import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'

import type { TurnId, TokenUsage } from '@/schemas/agentApiSchema'
import { zAgentWsEvent } from '@/schemas/agentApiSchema'
import type { AgentChatEvent } from '@/services/agent/agentEventTransport'

import { useAgentConversationStore } from './agentConversationStore'

// Schema-honest event builders (the v1 analog of the old frame() helper): a typo in a
// test event surfaces as a parse error here, not as a silently-dropped event. Only chat
// events are built, so each parse result is narrowed to AgentChatEvent.
const chat = (raw: unknown): AgentChatEvent =>
  zAgentWsEvent.parse(raw) as AgentChatEvent
const thinking = (id: string, delta: string): AgentChatEvent =>
  chat({
    type: 'agent_thinking',
    data: { delta, message_id: id, thread_id: 'th' }
  })
const delta = (id: string, text: string): AgentChatEvent =>
  chat({
    type: 'agent_message_delta',
    data: { delta: text, message_id: id, thread_id: 'th' }
  })
const toolCall = (id: string, name: string, status: string): AgentChatEvent =>
  chat({
    type: 'agent_tool_call',
    data: { tool_name: name, status, args: [], message_id: id, thread_id: 'th' }
  })
const done = (id: string, usage: TokenUsage | null): AgentChatEvent =>
  chat({
    type: 'agent_message_done',
    data: { message_id: id, thread_id: 'th', usage }
  })

const USAGE: TokenUsage = {
  input_tokens: 10,
  output_tokens: 5,
  total_tokens: 15,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0
}

const T1 = 't1' as TurnId
const T2 = 't2' as TurnId

describe('useAgentConversationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('(M1) fires a deep watch on messages when a MID-turn delta event lands', async () => {
    const store = useAgentConversationStore()
    const spy = vi.fn()
    watch(() => store.messages, spy, { deep: true })

    store.startTurn(T1)
    await nextTick()
    spy.mockClear()

    store.ingest(delta('t1', 'streaming delta'))
    await nextTick()

    // The fresh-reference-per-emit is what trips the watcher; an in-place mutation of
    // the same object reference would NOT (Object.is on the slot stays equal).
    expect(spy).toHaveBeenCalled()
    expect(store.messages[0].parts.map((p) => p.type)).toEqual(['text'])
  })

  it('(M2) isStreaming is false after abortActiveTurn() with no done', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'half a th'))
    expect(store.isStreaming).toBe(true)

    store.abortActiveTurn()

    expect(store.isStreaming).toBe(false)
    // The settled message itself carries streaming=false (the transport's in-place
    // abort), not merely the null-active fallback of isStreaming.
    expect(store.messages[0].streaming).toBe(false)
    // History is preserved (the partial message stays), unlike reset().
    expect(store.messages).toHaveLength(1)
    // A second abort is a no-op.
    store.abortActiveTurn()
    expect(store.messages).toHaveLength(1)
  })

  it('settles the turn on done and reports idle, adopting usage tokens', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'answer'))
    store.ingest(done('t1', USAGE))

    expect(store.isStreaming).toBe(false)
    expect(store.status).toBe('idle')
    expect(store.activeTurnId).toBeNull()
    expect(store.messages[0].tokens).toBe(15)
  })

  it('reports thinking vs streaming status', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(thinking('t1', 'planning'))
    expect(store.status).toBe('thinking')
    store.ingest(delta('t1', 'go'))
    expect(store.status).toBe('streaming')
  })

  it('drops events for a foreign message_id (store owns turn filtering)', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'keep'))

    // An event from a different (stale/foreign) turn must not bleed in. Every v1 chat
    // event carries data.message_id, so there is no absent-id case to test.
    store.ingest(delta('t2', 'DROP ME'))

    const parts = store.messages[0].parts
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ type: 'text', text: 'keep' })
  })

  it('starting a new turn aborts a prior in-flight turn', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'unfinished'))

    store.startTurn(T2)

    expect(store.messages).toHaveLength(2)
    // The prior turn is settled (no lingering spinner), the new one is live.
    expect(store.messages[0].streaming).toBe(false)
    expect(store.messages[1].streaming).toBe(true)
    expect(store.activeTurnId).toBe(T2)
  })

  it('ignores ingest with no active turn', () => {
    const store = useAgentConversationStore()
    store.ingest(delta('t1', 'orphan'))
    expect(store.messages).toHaveLength(0)
  })

  it('folds a tool_call into the active turn', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(toolCall('t1', 'add_node', 'ok'))
    expect(store.messages[0].parts[0]).toMatchObject({
      type: 'tool',
      name: 'add_node',
      ok: true
    })
  })

  it('recordFailedSend renders [user, assistant(notice)] and leaves the turn idle', () => {
    const store = useAgentConversationStore()
    store.recordFailedSend('local-error-1' as TurnId, 'boom', 'send failed')

    const entries = store.entries
    expect(entries.map((e) => e.role)).toEqual(['user', 'assistant'])
    expect(entries[0]).toMatchObject({ role: 'user', text: 'boom' })
    const assistant = entries[1]
    expect(assistant.role).toBe('assistant')
    if (assistant.role === 'assistant') {
      expect(assistant.streaming).toBe(false)
      expect(assistant.parts).toEqual([
        { type: 'notice', level: 'error', text: 'send failed' }
      ])
    }
    // No transport opened, no active turn touched.
    expect(store.activeTurnId).toBeNull()
    expect(store.isStreaming).toBe(false)
  })

  it('recordFailedSend does not disturb an already-active turn', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'live'))

    store.recordFailedSend('local-error-1' as TurnId, 'oops', 'send failed')

    // The live turn is untouched: still active and streaming.
    expect(store.activeTurnId).toBe(T1)
    expect(store.isStreaming).toBe(true)
  })

  it('reset wipes the whole conversation, distinct from abortActiveTurn', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'gone'))
    store.reset()
    expect(store.messages).toHaveLength(0)
    expect(store.activeTurnId).toBeNull()
    expect(store.isStreaming).toBe(false)
  })
})
