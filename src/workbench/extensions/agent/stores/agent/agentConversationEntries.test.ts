import { describe, expect, it } from 'vitest'

import type { TurnId } from '../../schemas/agentApiSchema'
import { zAgentWsEvent } from '../../schemas/agentApiSchema'
import type { AgentChatEvent } from '../../services/agent/agentEventTransport'
import type { WorkflowReference } from '../../types/workflowReference'
import { useAgentConversationStore } from './agentConversationStore'

const done = (id: string): AgentChatEvent =>
  zAgentWsEvent.parse({
    type: 'agent_message_done',
    data: { message_id: id, thread_id: 'th', usage: null }
  })

const T1 = 't1' as TurnId
const T2 = 't2' as TurnId

describe('agentConversationStore entries (user + assistant interleave)', () => {
  it.for<{
    source: string
    arrange: (
      store: ReturnType<typeof useAgentConversationStore>,
      marker: string
    ) => void
    workflowReferences?: WorkflowReference[]
  }>([
    {
      source: 'a live turn',
      arrange: (store, marker) => {
        store.recordUser(T1, `${marker} render it`, undefined, undefined, [
          { id: 'wf', name: 'Reference', textOffset: marker.length }
        ])
        store.startTurn(T1)
      },
      workflowReferences: [{ id: 'wf', name: 'Reference', textOffset: 0 }]
    },
    {
      source: 'history',
      arrange: (store, marker) =>
        store.hydrate([
          {
            id: 'row',
            thread_id: 'th',
            seq: 1,
            turn_id: T1,
            status: 'complete',
            role: 'user',
            content: {
              text: `${marker}[Reference](workflow://wf) render it`,
              workflow_references: [{ workflow_id: 'wf', name: 'Reference' }]
            }
          }
        ]),
      workflowReferences: [{ id: 'wf', name: 'Reference', textOffset: 0 }]
    },
    {
      source: 'a failed send',
      arrange: (store, marker) =>
        store.recordFailedSend(T1, `${marker} render it`, 'Send failed')
    },
    {
      source: 'a turn resumed without a persisted user row',
      arrange: (store, marker) => {
        store.setThreadId('th')
        store.recordUser(T1, `${marker} render it`)
        store.startTurn(T1)
        store.stashActiveTurn()
        store.hydrate([])
        store.resumeBackgroundTurn()
      }
    }
  ])(
    'restores the same sent skill from $source',
    ({ arrange, workflowReferences }) => {
      const store = useAgentConversationStore()
      arrange(
        store,
        '[Use the saved skill /portrait](skill://portrait?description=Use%20defaults)'
      )
      expect(store.entries[0]).toEqual({
        id: T1,
        role: 'user',
        text: ' render it',
        workflowReferences,
        skillReference: {
          name: 'portrait',
          description: 'Use defaults',
          textOffset: 0,
          workflowIndex: 0
        }
      })
    }
  )

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
