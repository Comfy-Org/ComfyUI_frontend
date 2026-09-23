import { mint } from '@comfyorg/comfy-multi-player'
import { render } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { getActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import * as Y from 'yjs'

import { api } from '@/scripts/api'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { encodeBase64 } from './docFrameClient'
import { createGraphMutations } from './graphMutations'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

const sent: string[] = []

const WORKFLOW_ID = 'wf-rejected-projection'
const scope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}

function deliver(type: string, data: unknown): void {
  EventTarget.prototype.dispatchEvent.call(
    api,
    new CustomEvent(type, { detail: data })
  )
}

function sentFrames(type: string): unknown[] {
  return sent
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
    sent.length = 0
    vi.stubGlobal('WebSocket', { OPEN: 1 })
    useAgentPanelStore().enabled = true
    api.socket = fromPartial<WebSocket>({
      readyState: 1,
      send: vi.fn((frame) => {
        if (typeof frame === 'string') sent.push(frame)
      })
    })
  })

  afterEach(() => {
    api.socket = null
  })

  it('loses a rejected projection when resubscription has no host delta', () => {
    let scopeAvailable = true
    const mutations = createGraphMutations({
      getScope: () => (scopeAvailable ? scope : null),
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() },
      placement: inertPlacementPort
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
      { global: { plugins: [getActivePinia()!] } }
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
      api.dispatchCustomEvent('reconnected')
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
