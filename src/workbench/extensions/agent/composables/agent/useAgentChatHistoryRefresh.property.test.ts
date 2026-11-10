import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'

import type {
  AgentRestClient,
  ThreadListing
} from '@/workbench/extensions/agent/services/agent/agentRestClient'
import { useAgentChatHistoryStore } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import { useAgentChatHistoryRefresh } from './useAgentChatHistoryRefresh'

const threadIds = ['t1', 't2', 't3', 't4']
const workflowIds = ['wf-a', 'wf-b', 'wf-c']

type Listing = { workflowId?: string; result: ThreadListing }

const arbListings = fc
  .record({
    initial: fc.array(fc.constantFrom(...workflowIds, ''), {
      minLength: 3,
      maxLength: 3
    }),
    steps: fc.array(
      fc.record({
        threadId: fc.constantFrom(...threadIds),
        movedTo: fc.option(fc.constantFrom(...workflowIds, '')),
        query: fc.option(fc.constantFrom(...workflowIds))
      }),
      { minLength: 2, maxLength: 7 }
    )
  })
  .map(({ initial, steps }) => {
    const server = new Map(initial.map((wf, i) => [threadIds[i], wf]))
    return steps.map(({ threadId, movedTo, query }): Listing => {
      if (movedTo === null) server.delete(threadId)
      else server.set(threadId, movedTo)
      const workflowId = query ?? undefined
      return {
        workflowId,
        result: {
          status: 'complete',
          threads: [...server]
            .filter(([, wf]) => workflowId === undefined || wf === workflowId)
            .map(([id, wf]) => ({
              id,
              title: id,
              preview: '',
              workflow_id: wf,
              status: 'active',
              message_count: 1,
              created_at: '2026-09-01T00:00:00Z',
              updated_at: '2026-09-20T00:00:00Z',
              last_message_at: '2026-10-01T00:00:00Z'
            }))
        }
      }
    })
  })

function setup() {
  const pending: Array<(result: ThreadListing) => void> = []
  const listThreads: AgentRestClient['listThreads'] = () =>
    new Promise((resolve) => pending.push(resolve))
  const history = useAgentChatHistoryStore()
  history.replaceAll([])
  const scope = effectScope()
  const refresh = scope.run(() =>
    useAgentChatHistoryRefresh({
      listThreads,
      history,
      untitledChat: () => 'Untitled chat',
      onFailure: () => {}
    })
  )!
  const view = () =>
    history.sessions
      .map(({ id, workflowId }) => `${id}:${workflowId ?? ''}`)
      .sort()
  return { pending, refresh, scope, view }
}

describe('useAgentChatHistoryRefresh properties', () => {
  it('shows the same history whatever order the listings answer in', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbListings.chain((listings) =>
          fc.tuple(
            fc.constant(listings),
            fc.shuffledSubarray(
              listings.map((_, i) => i),
              { minLength: listings.length, maxLength: listings.length }
            )
          )
        ),
        async ([listings, answerOrder]) => {
          const inOrder = setup()
          for (const { workflowId, result } of listings) {
            const refresh = inOrder.refresh.refreshHistory('none', workflowId)
            inOrder.pending.shift()!(result)
            await refresh
          }
          const expected = inOrder.view()
          inOrder.scope.stop()

          const shuffled = setup()
          const refreshes = listings.map(({ workflowId }) =>
            shuffled.refresh.refreshHistory('none', workflowId)
          )
          for (const i of answerOrder) {
            shuffled.pending[i](listings[i].result)
            await refreshes[i]
          }
          expect(shuffled.view()).toEqual(expected)
          shuffled.scope.stop()
        }
      ),
      { numRuns: 1000 }
    )
  })
})
