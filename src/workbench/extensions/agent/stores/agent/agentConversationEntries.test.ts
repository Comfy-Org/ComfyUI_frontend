import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { TurnId } from '../../schemas/agentApiSchema'
import { zAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentChatEvent } from '../../services/agent/agentEventTransport'
import { useAgentConversationStore } from './agentConversationStore'

const done = (id: string): AgentChatEvent =>
  zAgentWsEvent.parse({
    type: 'agent_message_done',
    data: { message_id: id, thread_id: 'th', usage: null }
  }) as AgentChatEvent

const T1 = 't1' as TurnId
const T2 = 't2' as TurnId

describe('agentConversationStore entries (user + assistant interleave)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('pairs each recorded user prompt before its assistant turn, in order', () => {
    const store = useAgentConversationStore()
    store.recordUser(T1, 'first prompt')
    store.startTurn(T1)
    store.ingest(done('t1'))
    store.recordUser(T2, 'second prompt')
    store.startTurn(T2)

    const roles = store.entries.map((e) => e.role)
    expect(roles).toEqual(['user', 'assistant', 'user', 'assistant'])
    const first = store.entries[0]
    expect(first.role === 'user' && first.text).toBe('first prompt')
  })

  it('renders an assistant turn with no recorded prompt as a bare assistant entry', () => {
    const store = useAgentConversationStore()
    store.startTurn(T1)
    expect(store.entries.map((e) => e.role)).toEqual(['assistant'])
  })

  it('reset clears recorded user prompts too', () => {
    const store = useAgentConversationStore()
    store.recordUser(T1, 'gone')
    store.startTurn(T1)
    store.reset()
    expect(store.entries).toHaveLength(0)
  })
})
