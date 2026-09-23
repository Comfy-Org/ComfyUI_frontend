import { mint } from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import * as Y from 'yjs'

import { api } from '@/scripts/api'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { encodeBase64 } from './docFrameClient'
import type { GraphMutations } from './graphMutations'
import { createGraphMutations } from './graphMutations'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

it('gates real document transport and removes reconnect listeners on revocation', async () => {
  const previousSocket = api.socket
  const send = vi.fn<(frame: string) => void>()
  api.socket = fromPartial<WebSocket>({ readyState: WebSocket.OPEN, send })
  onTestFinished(() => {
    api.socket = previousSocket
  })

  const store = useAgentPanelStore()
  store.enabled = false
  const workflowId = ref<string | null>('wf-1')
  let follower!: ReturnType<typeof useAgentCrdtFollower>
  const { unmount } = render(
    defineComponent({
      setup() {
        follower = useAgentCrdtFollower(
          workflowId,
          fromPartial<GraphMutations>({})
        )
        return () => null
      }
    })
  )
  onTestFinished(unmount)

  expect(send).not.toHaveBeenCalled()
  expect(follower.debugSnapshot()).toMatchObject({
    status: { enabled: false, workflowId: null },
    tabId: null,
    nodeIds: [],
    linkIds: []
  })

  store.enabled = true
  expect(send).toHaveBeenCalledOnce()
  expect(JSON.parse(send.mock.calls[0][0])).toMatchObject({
    type: 'doc_subscribe',
    data: { workflow_id: 'wf-1' }
  })

  store.enabled = false
  expect(send).toHaveBeenCalledTimes(2)
  expect(JSON.parse(send.mock.calls[1][0])).toMatchObject({
    type: 'doc_unsubscribe',
    data: { workflow_id: 'wf-1' }
  })
  api.dispatchCustomEvent('reconnected')
  api.dispatchCustomEvent('status', null)
  workflowId.value = 'wf-2'
  await nextTick()
  vi.advanceTimersByTime(60_000)
  expect(send).toHaveBeenCalledTimes(2)

  store.enabled = true
  expect(send).toHaveBeenCalledTimes(3)
  expect(JSON.parse(send.mock.calls[2][0])).toMatchObject({
    type: 'doc_subscribe',
    data: { workflow_id: 'wf-2' }
  })
  unmount()
  expect(send).toHaveBeenCalledTimes(4)
  expect(JSON.parse(send.mock.calls[3][0])).toMatchObject({
    type: 'doc_unsubscribe',
    data: { workflow_id: 'wf-2' }
  })
})

it.fails('keeps a projection-rejected sequence replayable through the composition', () => {
  const previousSocket = api.socket
  api.socket = fromPartial<WebSocket>({
    readyState: WebSocket.OPEN,
    send: vi.fn()
  })
  onTestFinished(() => {
    api.socket = previousSocket
  })

  const scope = {
    rootGraphId: toRootGraphId('root'),
    owningGraphId: toOwningGraphId('root')
  }
  const mutations = createGraphMutations({
    getScope: () => scope,
    layout: {
      createNode: vi.fn(),
      deleteNodes: vi.fn(),
      deleteGroups: vi.fn()
    },
    placement: inertPlacementPort
  })
  const realBatch = mutations.batch.bind(mutations)
  let rejectNextBatch = true
  let batchCount = 0
  const rejectingMutations: GraphMutations = {
    ...mutations,
    batch: (context, define) => {
      batchCount += 1
      if (rejectNextBatch) {
        rejectNextBatch = false
        return false
      }
      return realBatch(context, define)
    }
  }

  useAgentPanelStore().enabled = true
  const workflowId = ref<string | null>('wf-1')
  let follower!: ReturnType<typeof useAgentCrdtFollower>
  const { unmount } = render(
    defineComponent({
      setup() {
        follower = useAgentCrdtFollower(workflowId, rejectingMutations)
        return () => null
      }
    })
  )
  onTestFinished(unmount)

  const host = mint(
    { nodes: [{ id: 1, type: 'Source' }], links: [] },
    { types: { Source: { widget_order: [] } } }
  )
  onTestFinished(() => host.destroy())
  const frame = {
    v: 1,
    workflow_id: 'wf-1',
    seq: 1,
    update_b64: encodeBase64(Y.encodeStateAsUpdate(host))
  }

  EventTarget.prototype.dispatchEvent.call(
    api,
    new CustomEvent('doc_update', { detail: frame })
  )
  const sequenceAfterRejection = follower.debugSnapshot().lastSeq
  EventTarget.prototype.dispatchEvent.call(
    api,
    new CustomEvent('doc_update', { detail: frame })
  )

  expect({
    sequenceAfterRejection,
    sequenceAfterReplay: follower.debugSnapshot().lastSeq,
    batchCount,
    nodeIds: useNodeDataStore()
      .getGraphNodesFor('root', 'root')
      .map(({ id }) => id)
  }).toEqual({
    sequenceAfterRejection: 0,
    sequenceAfterReplay: 1,
    batchCount: 2,
    nodeIds: [toNodeId(1)]
  })
})
