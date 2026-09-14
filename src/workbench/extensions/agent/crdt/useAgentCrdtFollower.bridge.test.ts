import { mint, nodesMap } from '@comfyorg/comfy-multi-player'
import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import * as Y from 'yjs'

import type { GraphMutations } from '@/core/graph/graphMutations'

import { encodeBase64 } from './docFrameClient'

const apiState = vi.hoisted(() => {
  const target = new EventTarget()
  const sent: string[] = []
  return {
    target,
    sent,
    api: {
      socket: {
        readyState: 1,
        send: (frame: string) => sent.push(frame)
      },
      addCustomEventListener: (type: string, listener: EventListener) =>
        target.addEventListener(type, listener),
      removeCustomEventListener: (type: string, listener: EventListener) =>
        target.removeEventListener(type, listener),
      addEventListener: (type: string, listener: EventListener) =>
        target.addEventListener(type, listener),
      removeEventListener: (type: string, listener: EventListener) =>
        target.removeEventListener(type, listener)
    }
  }
})

const adapterState = vi.hoisted(() => ({
  applyFrame: vi.fn(() => true)
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({ api: apiState.api }))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { graph: null, canvas: null }
}))
vi.mock(import('./devPanelLog'), () => ({ recordDevEvent: vi.fn() }))
vi.mock(import('./agentNodeMaterializer'), () => ({
  reconcileAgentAdapters: vi.fn(() => [])
}))
vi.mock(import('./agentSubgraphDefinitions'), () => ({
  readSubgraphDefinitionIds: vi.fn(() => []),
  readSubgraphDefinitions: vi.fn(() => [])
}))
vi.mock<unknown>(import('./ecsFollowerAdapter'), () => ({
  EcsFollowerAdapter: class {
    bind = vi.fn()
    unbind = vi.fn()
    applyFrame = adapterState.applyFrame
    clearForReset = vi.fn()
    discardPending = vi.fn()
    destroy = vi.fn()
  }
}))

import { useAgentCrdtFollower } from './useAgentCrdtFollower'

const WORKFLOW_ID = 'wf-1'
const graphMutations = {} as GraphMutations

function deliver(type: string, detail: unknown): void {
  apiState.target.dispatchEvent(new CustomEvent(type, { detail }))
}

function framesOfType(type: string): Array<{ type: string }> {
  return apiState.sent
    .map((frame) => JSON.parse(frame) as { type: string })
    .filter((frame) => frame.type === type)
}

function readableUpdate(): Uint8Array {
  const doc = mint({ nodes: [], links: [] }, { types: {} })
  const node = new Y.Map<unknown>()
  node.set('type', 'LoadImage')
  nodesMap(doc).set('1', node)
  return Y.encodeStateAsUpdate(doc)
}

describe('useAgentCrdtFollower with the real subscription bridge', () => {
  it('recovers from a stale same-workflow refusal without retrying or writing after a genuine refusal', () => {
    let follower!: ReturnType<typeof useAgentCrdtFollower>
    const host = defineComponent({
      setup() {
        follower = useAgentCrdtFollower(
          ref(WORKFLOW_ID),
          graphMutations,
          () => 'user-1',
          ref(true),
          () => null,
          ref('Document schema version mismatch')
        )
        return () => null
      }
    })
    const { unmount } = render(host)
    expect(framesOfType('doc_subscribe')).toHaveLength(1)

    // Attempt 2 overlaps attempt 1 for the same workflow. The protocol has no
    // attempt id, so the refusal for attempt 1 is indistinguishable on the wire.
    apiState.target.dispatchEvent(new Event('reconnected'))
    expect(framesOfType('doc_subscribe')).toHaveLength(2)
    deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: false,
      code: 'schema_version_mismatch',
      message: 'stale refusal'
    })

    expect(follower.status.value.connected).toBe(false)
    expect(follower.status.value.schemaError).toBe('stale refusal')
    apiState.target.dispatchEvent(new Event('status'))
    follower.enqueueHumanOperations([
      { op: 'delete_node', node_id: 'before', removed_links: [] }
    ])
    expect(framesOfType('doc_subscribe')).toHaveLength(2)
    expect(framesOfType('doc_ops')).toHaveLength(0)

    // Attempt 2 was actually accepted. Its ack alone is not proof the document
    // is readable and must not lift the gate or reopen writes.
    deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 1
    })
    expect(follower.status.value.connected).toBe(false)
    follower.enqueueHumanOperations([
      { op: 'delete_node', node_id: 'after-ack', removed_links: [] }
    ])
    expect(framesOfType('doc_ops')).toHaveLength(0)

    // A readable update from the accepted attempt is positive recovery proof.
    deliver('doc_update', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      seq: 1,
      update_b64: encodeBase64(readableUpdate())
    })
    expect(adapterState.applyFrame).toHaveBeenCalledOnce()
    expect(follower.status.value.connected).toBe(true)
    expect(follower.status.value.schemaError).toBeNull()

    follower.enqueueHumanOperations([
      { op: 'delete_node', node_id: 'after-update', removed_links: [] }
    ])
    expect(framesOfType('doc_ops')).toHaveLength(1)
    unmount()
  })
})
