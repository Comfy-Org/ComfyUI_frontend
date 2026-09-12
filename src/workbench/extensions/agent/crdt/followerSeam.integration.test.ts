import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { createGraphMutations } from '@/core/graph/graphMutations'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import type { DocFrameTransport, DocUpdate } from './docFrameClient'
import { DocFrameClient, encodeBase64 } from './docFrameClient'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { LayoutFollowerBridge } from './layoutFollowerBridge'

const WORKFLOW_ID = 'follower-seam-workflow'
const scope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}

class FrameTransport extends EventTarget implements DocFrameTransport {
  readonly sent: string[] = []

  send(frame: string): boolean {
    this.sent.push(frame)
    return true
  }

  deliver(type: string, data: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail: data }))
  }
}

function opIdFor(nodeId: number): string {
  return String(nodeId).padStart(32, '0')
}

/**
 * A host doc that emits one update per added node: the first carries the whole
 * state (including the schema meta the read gate requires), each later one only
 * the delta, exactly as the relay fans out a live session.
 */
function hostSession() {
  const host = mint({ nodes: [], links: [] }, { types: {} })
  let emitted = 0
  return {
    add(nodeId: number): Uint8Array {
      const before = Y.encodeStateVector(host)
      const result = applyOps(
        host,
        [
          {
            op: 'add_node',
            op_id: opIdFor(nodeId),
            actor: 'agent:test',
            base_version: nodeId,
            stamp: [nodeId, 'agent:test'],
            node_id: nodeId,
            class_type: 'FollowerSeamNode',
            pos: [128, 96],
            node: {
              id: nodeId,
              type: 'FollowerSeamNode',
              pos: [128, 96],
              inputs: [],
              outputs: []
            }
          }
        ],
        { types: {} }
      )
      expect(result.outcomes).toEqual([
        { op_id: opIdFor(nodeId), outcome: 'applied' }
      ])
      return emitted++ === 0
        ? Y.encodeStateAsUpdate(host)
        : Y.encodeStateAsUpdate(host, before)
    },
    destroy(): void {
      host.destroy()
    }
  }
}

function hostUpdate(): Uint8Array {
  const session = hostSession()
  try {
    return session.add(1)
  } finally {
    session.destroy()
  }
}

function setup(getScope: () => typeof scope | null = () => scope) {
  const transport = new FrameTransport()
  const client = new DocFrameClient(transport)
  const bridge = new LayoutFollowerBridge(client)
  const createLayout = vi.fn()
  const mutations = createGraphMutations({
    getScope,
    layout: { createNode: createLayout, deleteNodes: vi.fn() }
  })
  const adapter = new EcsFollowerAdapter(mutations)
  const redispatched = vi.fn()
  const applyResults: boolean[] = []
  adapter.bind(WORKFLOW_ID, bridge.follower)
  bridge.addEventListener('doc_update', (event) => {
    if (!(event instanceof CustomEvent)) return
    const update = event.detail as DocUpdate
    redispatched(update)
    applyResults.push(adapter.applyFrame(update))
  })
  bridge.subscribe(WORKFLOW_ID)
  return {
    applyResults,
    bridge,
    createLayout,
    redispatched,
    transport,
    destroy() {
      adapter.destroy()
      bridge.destroy()
      client.destroy()
    }
  }
}

describe('follower seam integration', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('projects a real shared-applier update into the ECS graph stores', () => {
    const seam = setup()
    try {
      seam.transport.deliver('doc_update', {
        v: 1,
        workflow_id: WORKFLOW_ID,
        seq: 1,
        actor: 'agent:test',
        op_ids: ['00000000000000000000000000000001'],
        update_b64: encodeBase64(hostUpdate())
      })

      expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([
        expect.objectContaining({
          id: toNodeId(1),
          type: 'FollowerSeamNode'
        })
      ])
      expect(seam.createLayout).toHaveBeenCalledWith(
        scope,
        toNodeId(1),
        expect.objectContaining({ position: { x: 128, y: 96 } }),
        expect.objectContaining({
          source: 'agent-remote',
          opId: '00000000000000000000000000000001'
        })
      )
    } finally {
      seam.destroy()
    }
  })

  it('does not project frames for another workflow', () => {
    const seam = setup()
    try {
      seam.transport.deliver('doc_update', {
        v: 1,
        workflow_id: 'other-workflow',
        seq: 1,
        update_b64: encodeBase64(hostUpdate())
      })

      expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
      expect(seam.createLayout).not.toHaveBeenCalled()
      expect(seam.redispatched).not.toHaveBeenCalled()
    } finally {
      seam.destroy()
    }
  })

  it('does not replay ECS effects for a duplicate sequence', () => {
    const seam = setup()
    try {
      const frame = {
        v: 1,
        workflow_id: WORKFLOW_ID,
        seq: 1,
        update_b64: encodeBase64(hostUpdate())
      }
      seam.transport.deliver('doc_update', frame)
      seam.transport.deliver('doc_update', frame)

      expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toHaveLength(
        1
      )
      expect(seam.createLayout).toHaveBeenCalledTimes(1)
      expect(seam.redispatched).toHaveBeenCalledTimes(1)
    } finally {
      seam.destroy()
    }
  })

  it('projects an update withheld for missing scope once scope returns', () => {
    let liveScope: typeof scope | null = null
    const seam = setup(() => liveScope)
    const host = hostSession()
    try {
      seam.transport.deliver('doc_update', {
        v: 1,
        workflow_id: WORKFLOW_ID,
        seq: 1,
        update_b64: encodeBase64(host.add(1))
      })

      expect(seam.bridge.lastSequence).toBe(1)
      expect(seam.bridge.follower.updatesApplied).toBe(1)
      expect(seam.applyResults).toEqual([false])
      expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
      expect(seam.createLayout).not.toHaveBeenCalled()

      liveScope = scope
      seam.transport.deliver('doc_update', {
        v: 1,
        workflow_id: WORKFLOW_ID,
        seq: 2,
        update_b64: encodeBase64(host.add(2))
      })

      expect(seam.applyResults).toEqual([false, true])
      expect(
        useNodeDataStore()
          .getGraphNodesFor('root', 'root')
          .map((node) => node.id)
      ).toEqual([toNodeId(1), toNodeId(2)])
      expect(seam.createLayout).toHaveBeenCalledTimes(2)
    } finally {
      host.destroy()
      seam.destroy()
    }
  })
})
