import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'

import type { AgentMessages, TurnId } from '../../schemas/agentApiSchema'
import { zAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentChatEvent } from '../../services/agent/agentEventTransport'

import { useAgentConversationStore } from './agentConversationStore'

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
    data: {
      tool_call_id: `call-${name}`,
      tool_name: name,
      status,
      message_id: id,
      thread_id: 'th'
    }
  })
const done = (id: string): AgentChatEvent =>
  chat({
    type: 'agent_message_done',
    data: { message_id: id, thread_id: 'th', usage: null }
  })

const T1 = 't1' as TurnId
const T2 = 't2' as TurnId

const historyRow = (
  seq: number,
  role: 'user' | 'assistant',
  turnId: string,
  text: string,
  id: string = `row-${seq}`
): AgentMessages[number] => ({
  id,
  thread_id: 'th',
  seq,
  role,
  status: 'complete',
  turn_id: turnId,
  content: { text }
})

const activeTab = (
  workflowId: string,
  id?: string,
  threadId = 'th'
): AgentChatEvent =>
  chat({
    type: 'agent_active_tab',
    data: { workflow_id: workflowId, message_id: id, thread_id: threadId }
  })

const tabLinkIds = (store: ReturnType<typeof useAgentConversationStore>) =>
  store.messages.flatMap((m) =>
    m.parts.flatMap((p) => (p.type === 'tabLink' ? [p.workflowId] : []))
  )

const partTexts = (store: ReturnType<typeof useAgentConversationStore>) =>
  store.messages.flatMap((m) =>
    m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : []))
  )

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

    expect(spy).toHaveBeenCalled()
    expect(store.messages[0].parts.map((p) => p.type)).toEqual(['text'])
  })

  it('records a tab link on the live turn for the wire shape carrying a message id', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)

    store.ingest(activeTab('wf-1', 't1'))

    expect(tabLinkIds(store)).toEqual(['wf-1'])
  })

  it('records a tab link on the live turn when the optional message id is absent', () => {
    // message_id is optional on agent_active_tab alone, so the thread has to be
    // enough to place the link.
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)

    store.ingest(activeTab('wf-1'))

    expect(tabLinkIds(store)).toEqual(['wf-1'])
  })

  it('records a tab link on a stashed background thread, not on the displayed one', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'work in the background')
    store.stashActiveTurn()
    store.setThreadId('th-other')
    store.hydrate([])
    store.startTurn(T2)

    store.ingest(activeTab('wf-9', undefined, 'th'))

    expect(tabLinkIds(store)).toEqual([])
    store.setThreadId('th')
    store.hydrate([])
    store.resumeBackgroundTurn()
    expect(tabLinkIds(store)).toEqual(['wf-9'])
  })

  it('routes colliding turn ids by thread before the displayed transport', () => {
    const store = useAgentConversationStore()
    store.setThreadId('visible')
    store.startTurn(T1)
    store.startBackgroundTurn('background', T1, 'background prompt')

    store.ingest(
      chat({
        type: 'agent_message_delta',
        data: {
          delta: 'background reply',
          message_id: T1,
          thread_id: 'background'
        }
      })
    )

    expect(partTexts(store)).not.toContain('background reply')
    store.stashActiveTurn()
    store.setThreadId('background')
    store.resumeBackgroundTurn()
    expect(partTexts(store)).toContain('background reply')
  })

  it('(M2) isStreaming is false after abortActiveTurn() with no done', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'half a th'))
    expect(store.isStreaming).toBe(true)

    store.abortActiveTurn()

    expect(store.isStreaming).toBe(false)
    expect(store.messages[0].streaming).toBe(false)
    expect(store.messages).toHaveLength(1)
    store.abortActiveTurn()
    expect(store.messages).toHaveLength(1)
  })

  it('settles the turn on done and reports idle', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'answer'))
    store.ingest(done('t1'))

    expect(store.isStreaming).toBe(false)
    expect(store.status).toBe('idle')
    expect(store.activeTurnId).toBeNull()
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
    store.ingest(toolCall('t1', 'add_node', 'success'))
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
    expect(store.activeTurnId).toBeNull()
    expect(store.isStreaming).toBe(false)
  })

  it('recordFailedSend does not disturb an already-active turn', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.ingest(delta('t1', 'live'))

    store.recordFailedSend('local-error-1' as TurnId, 'oops', 'send failed')

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

  it('holds the thread id and clears it on reset', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th-7')
    expect(store.threadId).toBe('th-7')
    store.reset()
    expect(store.threadId).toBeNull()
  })

  it('revokes transcript blob previews on reset and on hydrate', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const store = useAgentConversationStore()
    store.startTurn(T1)
    store.recordUser(T1, 'with picture', [
      { name: 'a.png', previewUrl: 'blob:a' }
    ])
    store.reset()
    expect(revoke).toHaveBeenCalledWith('blob:a')

    revoke.mockClear()
    store.startTurn(T2)
    store.recordUser(T2, 'again', [{ name: 'b.png', previewUrl: 'blob:b' }])
    store.hydrate([])
    expect(revoke).toHaveBeenCalledWith('blob:b')
    expect(
      store.entries.every(
        (entry) => entry.role !== 'user' || entry.attachments === undefined
      )
    ).toBe(true)
    revoke.mockRestore()
  })

  it('keeps a stashed background turn across reset so returning to the thread resumes it', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'go')
    store.ingest(delta('t1', 'work'))
    store.stashActiveTurn()

    store.reset()
    expect(store.messages).toHaveLength(0)

    store.setThreadId('th')
    store.resumeBackgroundTurn()

    expect(store.entries.map((e) => e.role)).toEqual(['user', 'assistant'])
    expect(store.messages.map((m) => m.id)).toEqual([T1])
    expect(store.isStreaming).toBe(true)
  })

  it('keeps a stashed background turn across hydrate so returning to the thread resumes it', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'go')
    store.ingest(delta('t1', 'work'))
    store.stashActiveTurn()

    store.setThreadId('th-other')
    store.hydrate([])
    expect(store.messages).toHaveLength(0)

    store.setThreadId('th')
    store.hydrate([])
    store.resumeBackgroundTurn()

    expect(store.entries.map((e) => e.role)).toEqual(['user', 'assistant'])
    expect(store.messages.map((m) => m.id)).toEqual([T1])
    expect(store.isStreaming).toBe(true)
  })

  it('keeps a settled background reply when an earlier history turn shares its prompt text', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T2)
    store.recordUser(T2, 'go')
    store.ingest(delta('t2', 'the awaited reply'))
    store.stashActiveTurn()
    store.ingest(done('t2'))

    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'go'),
      historyRow(2, 'assistant', 'turn-a', 'older reply'),
      historyRow(3, 'user', 'turn-b', 'different'),
      historyRow(4, 'assistant', 'turn-b', 'other reply')
    ])
    store.resumeBackgroundTurn()

    expect(partTexts(store)).toContain('the awaited reply')
  })

  it('hydrates transcript turns in sequence order', () => {
    const store = useAgentConversationStore()

    store.hydrate([
      historyRow(4, 'assistant', 'turn-b', 'Second reply'),
      historyRow(2, 'assistant', 'turn-a', 'First reply'),
      historyRow(1, 'user', 'turn-a', 'First prompt'),
      historyRow(3, 'user', 'turn-b', 'Second prompt')
    ])

    expect(store.entries.map((entry) => entry.id)).toEqual([
      'turn-a',
      'turn-a',
      'turn-b',
      'turn-b'
    ])
    expect(partTexts(store)).toEqual(['First reply', 'Second reply'])
  })

  it('keeps hydrated turn identity stable when persisted row ids change', () => {
    const store = useAgentConversationStore()
    const firstRows = [
      historyRow(1, 'user', 'turn-a', 'Prompt', 'user-row-v1'),
      historyRow(2, 'assistant', 'turn-a', 'Reply', 'assistant-row-v1')
    ]

    store.hydrate(firstRows)
    const firstMessage = store.messages[0]
    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'Prompt', 'user-row-v2'),
      historyRow(2, 'assistant', 'turn-a', 'Reply', 'assistant-row-v2')
    ])

    expect(store.messages[0].id).toBe(firstMessage.id)
    expect(store.messages[0].id).toBe('turn-a')
  })

  it('keeps an earlier completed turn when a returning live turn repeats its prompt text', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T2)
    store.recordUser(T2, 'go')
    store.ingest(delta('t2', 'second reply'))
    store.stashActiveTurn()

    store.hydrate([
      historyRow(1, 'user', 'turn-a', 'go'),
      historyRow(2, 'assistant', 'turn-a', 'first reply')
    ])
    store.resumeBackgroundTurn()

    const texts = partTexts(store)
    expect(texts).toContain('first reply')
    expect(texts).toContain('second reply')
    expect(store.isStreaming).toBe(true)
  })

  it('does not duplicate a settled background turn persisted under a server turn id', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.startTurn(T1)
    store.recordUser(T1, 'go')
    store.ingest(delta('t1', 'live reply'))
    store.stashActiveTurn()
    store.ingest(done('t1'))

    store.hydrate([
      historyRow(1, 'user', 'server-turn', 'go'),
      historyRow(2, 'assistant', 'server-turn', 'persisted reply', 't1')
    ])
    store.resumeBackgroundTurn()

    expect(store.messages.map((message) => message.id)).toEqual(['server-turn'])
    expect(partTexts(store)).toEqual(['persisted reply'])
    expect(store.isStreaming).toBe(false)
  })
})
