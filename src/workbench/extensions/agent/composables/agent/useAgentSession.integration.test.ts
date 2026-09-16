import { applyOps, mint } from '@comfyorg/comfy-multi-player'
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
  it('keeps background-thread nodes out of the foreground report for the same workflow', async () => {
    const rest = restWithHistory(Promise.resolve([]))
    vi.mocked(rest.postMessage)
      .mockResolvedValueOnce({
        thread_id: 'thread-a',
        message_id: 'message-a',
        workflow_id: 'workflow-1'
      })
      .mockResolvedValueOnce({
        thread_id: 'thread-b',
        message_id: 'message-b',
        workflow_id: 'workflow-1'
      })
    const session = useAgentSession({
      rest,
      events,
      workflow: {
        current: () => ({ id: 'workflow-1', tabPath: 'shared.json' }),
        adopted: () => undefined
      }
    })
    const host = mint({ nodes: [], links: [] }, catalog)
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(
      createGraphMutations({
        getScope: () => scope,
        layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
      })
    )
    adapter.bind('workflow-1', follower)
    function deliver(update: Uint8Array, seq: number, actor?: string) {
      follower.applyRemoteUpdate(update)
      expect(
        adapter.applyFrame({ workflowId: 'workflow-1', seq, update, actor })
      ).toBe(true)
    }
    function add(id: number, actor: string) {
      const before = Y.encodeStateVector(host)
      const opId = `add-${id}`
      applyOps(
        host,
        [
          {
            op: 'add_node',
            op_id: opId,
            actor,
            base_version: id,
            stamp: [id, actor],
            node_id: id,
            class_type: 'Source',
            pos: [id * 37, id * 53],
            node: { id, type: 'Source', pos: [id * 37, id * 53] }
          }
        ],
        catalog
      )
      deliver(Y.encodeStateAsUpdate(host, before), id + 1, actor)
    }

    try {
      session.start()
      expect(await session.sendMessage('Start A')).toBe(true)
      session.newChat()
      expect(await session.sendMessage('Start B')).toBe(true)
      expect(session.boundWorkflowId.value).toBe('workflow-1')
      deliver(Y.encodeStateAsUpdate(host), 1)
      add(17, 'agent:thread-a:backend-turn-a')
      add(29, 'agent:thread-b:backend-turn-b')

      const activity = useAgentGeneratedNodesStore()
      expect(activity.generatedAtFor(scope, toNodeId(17))).toBeTypeOf('number')
      expect(activity.generatedAtFor(scope, toNodeId(29))).toBeTypeOf('number')
      expect(activity.activities.get(scope.rootGraphId)).toMatchObject({
        turnId: 'message-b',
        nodes: ['29']
      })
    } finally {
      adapter.destroy()
      follower.destroy()
      host.destroy()
      session.stop()
    }
  })

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
