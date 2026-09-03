import { mint } from '@comfyorg/comfy-multi-player'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import * as Y from 'yjs'

import { render } from '@testing-library/vue'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { encodeBase64 } from './docFrameClient'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

const apiState = vi.hoisted(() => {
  const events = new EventTarget()
  const sent: string[] = []
  return {
    events,
    sent,
    api: {
      socket: {
        readyState: 1,
        send: vi.fn((frame: string) => sent.push(frame))
      },
      addCustomEventListener: (type: string, listener: EventListener) =>
        events.addEventListener(type, listener),
      removeCustomEventListener: (type: string, listener: EventListener) =>
        events.removeEventListener(type, listener),
      addEventListener: (type: string, listener: EventListener) =>
        events.addEventListener(type, listener),
      removeEventListener: (type: string, listener: EventListener) =>
        events.removeEventListener(type, listener)
    }
  }
})

vi.mock('@/scripts/api', () => ({ api: apiState.api }))

const WORKFLOW_ID = 'wf-rejected-projection'
const scope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}

function deliver(type: string, data: unknown): void {
  apiState.events.dispatchEvent(new CustomEvent(type, { detail: data }))
}

function sentFrames(type: string): { type: string; data: unknown }[] {
  return apiState.sent
    .map((frame) => JSON.parse(frame) as { type: string; data: unknown })
    .filter((frame) => frame.type === type)
}

describe('useAgentCrdtFollower projection recovery', () => {
  beforeEach(() => {
    apiState.sent.length = 0
    vi.stubGlobal('WebSocket', { OPEN: 1 })
  })

  it('retries a rejected projection when resubscription has no host delta', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    let scopeAvailable = true
    const mutations = createGraphMutations({
      getScope: () => (scopeAvailable ? scope : null),
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
    mutations.addNode(
      { id: 99, type: 'Sink' },
      {
        source: 'agent-remote',
        actor: 'local-hydration',
        opId: 'local-seed'
      }
    )
    const host = mint({ nodes: [], links: [] }, { types: {} })
    const update = Y.encodeStateAsUpdate(host)
    const view = render(
      defineComponent({
        setup() {
          useAgentCrdtFollower(ref(WORKFLOW_ID), mutations)
          return () => null
        }
      }),
      { global: { plugins: [pinia] } }
    )

    try {
      deliver('doc_subscribed', {
        v: 1,
        workflow_id: WORKFLOW_ID,
        ok: true,
        seq: 1
      })
      scopeAvailable = false
      deliver('doc_update', {
        v: 1,
        workflow_id: WORKFLOW_ID,
        seq: 1,
        update_b64: encodeBase64(update)
      })
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(99)])

      scopeAvailable = true
      apiState.events.dispatchEvent(new CustomEvent('reconnected'))
      const subscribes = sentFrames('doc_subscribe') as {
        type: 'doc_subscribe'
        data: { state_vector_b64: string }
      }[]
      expect(subscribes.at(-1)?.data.state_vector_b64).toBe(
        encodeBase64(Y.encodeStateVector(host))
      )
      deliver('doc_subscribed', {
        v: 1,
        workflow_id: WORKFLOW_ID,
        ok: true,
        seq: 1
      })

      expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    } finally {
      view.unmount()
      host.destroy()
    }
  })
})
