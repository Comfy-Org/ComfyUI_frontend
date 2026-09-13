import { mint } from '@comfyorg/comfy-multi-player'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
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
  const state = {
    events: new EventTarget(),
    sent: Array<string>()
  }
  return {
    state,
    api: {
      socket: {
        readyState: 1,
        send: vi.fn((frame: string) => state.sent.push(frame))
      },
      addCustomEventListener: (type: string, listener: EventListener) =>
        state.events.addEventListener(type, listener),
      removeCustomEventListener: (type: string, listener: EventListener) =>
        state.events.removeEventListener(type, listener),
      addEventListener: (type: string, listener: EventListener) =>
        state.events.addEventListener(type, listener),
      removeEventListener: (type: string, listener: EventListener) =>
        state.events.removeEventListener(type, listener)
    }
  }
})

vi.mock(import('@/scripts/api'), async (importOriginal) => {
  const actual = await importOriginal()
  Object.assign(actual.api, apiState.api)
  return actual
})

const WORKFLOW_ID = 'wf-rejected-projection'
const scope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}

function deliver(type: string, data: unknown): void {
  apiState.state.events.dispatchEvent(new CustomEvent(type, { detail: data }))
}

function sentFrames(type: string): unknown[] {
  return apiState.state.sent
    .map((frame): unknown => JSON.parse(frame))
    .filter(
      (frame) =>
        typeof frame === 'object' &&
        frame !== null &&
        'type' in frame &&
        frame.type === type
    )
}

describe('useAgentCrdtFollower projection recovery', () => {
  beforeEach(() => {
    apiState.state.events = new EventTarget()
    apiState.state.sent.length = 0
    vi.stubGlobal('WebSocket', { OPEN: 1 })
  })

  it('loses a rejected projection when resubscription has no host delta', () => {
    const pinia = createTestingPinia({ stubActions: false })
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
      apiState.state.events.dispatchEvent(new CustomEvent('reconnected'))
      expect(sentFrames('doc_subscribe').at(-1)).toMatchObject({
        data: {
          state_vector_b64: encodeBase64(Y.encodeStateVector(host))
        }
      })
      deliver('doc_subscribed', {
        v: 1,
        workflow_id: WORKFLOW_ID,
        ok: true,
        seq: 1
      })

      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map(({ id }) => id)
      ).toEqual([toNodeId(99)])
    } finally {
      view.unmount()
      host.destroy()
    }
  })
})
