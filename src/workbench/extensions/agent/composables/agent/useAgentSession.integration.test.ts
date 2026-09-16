import { mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import type { DocUpdate } from '../../crdt/docFrameClient'
import { EcsFollowerAdapter } from '../../crdt/ecsFollowerAdapter'
import { FollowerDoc } from '../../crdt/followerDoc'
import type {
  AgentAnswerAccepted,
  AgentCancelAccepted,
  AgentMessages,
  AgentRunModePreference,
  AgentTurnAccepted
} from '../../schemas/agentApiSchema'
import { toTurnId } from '../../schemas/agentApiSchema'
import type { AgentRestClient } from '../../services/agent/agentRestClient'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentGeneratedNodesStore } from '../../stores/agentGeneratedNodesStore'

import type { AgentEventSource } from './useAgentSession'
import { useAgentSession } from './useAgentSession'

const events: AgentEventSource = { subscribe: () => () => undefined }
const catalog: WidgetCatalog = { types: { Source: { widget_order: [] } } }
const scope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}

function deferredHistory() {
  let resolve: (value: AgentMessages) => void = () => undefined
  const promise = new Promise<AgentMessages>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function restWithHistory(history: Promise<AgentMessages>): AgentRestClient {
  return {
    postMessage: vi.fn(
      async (): Promise<AgentTurnAccepted> => ({
        thread_id: 'thread-1',
        message_id: 'message-1'
      })
    ),
    getMessages: vi.fn(() => history),
    listThreads: vi.fn(async () => []),
    getRunMode: vi.fn(
      async (): Promise<AgentRunModePreference> => ({
        mode: 'auto',
        credit_limit: null
      })
    ),
    putRunMode: vi.fn(async (preference) => preference),
    listCloudWorkflows: vi.fn(async () => []),
    cancelMessage: vi.fn(
      async (): Promise<AgentCancelAccepted> => ({ status: 'cancelling' })
    ),
    answerAsk: vi.fn(
      async (): Promise<AgentAnswerAccepted> => ({ status: 'answered' })
    ),
    uploadImage: vi.fn(async () => ({
      name: 'image.png',
      subfolder: '',
      type: 'input'
    }))
  }
}

describe('useAgentSession REST and CRDT composition', () => {
  it.for([true, false])(
    'attributes a catch-up frame to a remounted turn when catch-up precedes REST: %s',
    async (catchUpBeforeRest) => {
      const conversation = useAgentConversationStore()
      conversation.setThreadId('thread-1')
      conversation.startTurn(toTurnId('message-1'))
      const history = deferredHistory()
      const session = useAgentSession({
        rest: restWithHistory(history.promise),
        events
      })
      const mutations = createGraphMutations({
        getScope: () => scope,
        layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
      })
      const host = mint(
        {
          nodes: [
            {
              id: 17,
              type: 'Source',
              pos: [0, 0],
              size: [100, 80],
              inputs: [],
              outputs: []
            }
          ],
          links: []
        },
        catalog
      )
      const follower = new FollowerDoc()
      const adapter = new EcsFollowerAdapter(mutations)
      adapter.bind('workflow-1', follower)
      const update = Y.encodeStateAsUpdate(host)
      const deliverCatchUp = () => {
        follower.applyRemoteUpdate(update)
        adapter.applyFrame({
          workflowId: 'workflow-1',
          seq: 1,
          update,
          actor: 'agent:thread-1:message-1',
          opIds: ['node-add-17']
        } satisfies DocUpdate)
      }

      try {
        session.start()
        expect(session.restorationReady.value).toBe(false)
        if (catchUpBeforeRest) deliverCatchUp()
        history.resolve([])
        await vi.waitFor(() =>
          expect(session.restorationReady.value).toBe(true)
        )
        if (!catchUpBeforeRest) deliverCatchUp()

        const activity = useAgentGeneratedNodesStore()
        expect(activity.generatedAtFor(scope, toNodeId(17))).toBeTypeOf(
          'number'
        )
        expect(activity.activities.get(scope.rootGraphId)).toMatchObject({
          phase: 'working',
          turnId: 'message-1'
        })
        expect(conversation.activeTurnId).toBe('message-1')
      } finally {
        adapter.destroy()
        follower.destroy()
        host.destroy()
        session.stop()
      }
    }
  )
})
