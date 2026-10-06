import { describe, expect, it } from 'vitest'

import type { TurnId } from '../../schemas/agentApiSchema'
import { zAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentChatEvent } from '../../services/agent/agentEventTransport'
import { useAgentConversationStore } from './agentConversationStore'

const done = (id: string): AgentChatEvent =>
  zAgentWsEvent.parse({
    type: 'agent_message_done',
    data: { message_id: id, thread_id: 'th', usage: null }
  })

const T1 = 't1' as TurnId
const T2 = 't2' as TurnId

describe('agentConversationStore entries (user + assistant interleave)', () => {
  it('retains a selected skill while a turn is stashed and resumed without a persisted user row', () => {
    const store = useAgentConversationStore()
    store.setThreadId('th')
    store.recordUser(
      T1,
      '[Use the saved skill /portrait](skill://portrait?description=Defaults) render it'
    )
    store.startTurn(T1)
    store.stashActiveTurn()
    store.hydrate([])
    store.resumeBackgroundTurn()
    expect(store.entries[0]).toMatchObject({
      role: 'user',
      text: ' render it',
      skillReference: {
        name: 'portrait',
        description: 'Defaults',
        textOffset: 0
      }
    })
    store.reset()
    store.recordUser(T1, '/portrait plain text')
    store.startTurn(T1)
    expect(store.entries[0]).toMatchObject({ text: '/portrait plain text' })
    expect(store.entries[0]).not.toHaveProperty('skillReference')
  })
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
