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

function hostUpdate(): Uint8Array {
  const host = mint({ nodes: [], links: [] }, { types: {} })
  const result = applyOps(
    host,
    [
      {
        op: 'add_node',
        op_id: '00000000000000000000000000000001',
        actor: 'agent:test',
        base_version: 1,
        stamp: [1, 'agent:test'],
        node_id: 1,
        class_type: 'FollowerSeamNode',
        pos: [128, 96],
        node: {
          id: 1,
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
    {
      op_id: '00000000000000000000000000000001',
      outcome: 'applied'
    }
  ])
  const update = Y.encodeStateAsUpdate(host)
  host.destroy()
  return update
}

function setup() {
  const transport = new FrameTransport()
  const client = new DocFrameClient(transport)
  const bridge = new LayoutFollowerBridge(client)
  const createLayout = vi.fn()
  const mutations = createGraphMutations({
    getScope: () => scope,
    layout: { createNode: createLayout, deleteNodes: vi.fn() }
  })
  const adapter = new EcsFollowerAdapter(mutations)
  adapter.bind(WORKFLOW_ID, bridge.follower)
  bridge.addEventListener('doc_update', (event) => {
    if (event instanceof CustomEvent)
      adapter.applyFrame(event.detail as DocUpdate)
  })
  bridge.subscribe(WORKFLOW_ID)
  return { adapter, bridge, client, createLayout, transport }
}

describe('follower seam integration', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('projects a real shared-applier update into the ECS graph stores', () => {
    const seam = setup()
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
    seam.adapter.destroy()
    seam.bridge.destroy()
    seam.client.destroy()
  })

  it('does not project frames for another workflow', () => {
    const seam = setup()
    seam.transport.deliver('doc_update', {
      v: 1,
      workflow_id: 'other-workflow',
      seq: 1,
      update_b64: encodeBase64(hostUpdate())
    })

    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
    expect(seam.createLayout).not.toHaveBeenCalled()
    seam.adapter.destroy()
    seam.bridge.destroy()
    seam.client.destroy()
  })

  it('does not replay ECS effects for a duplicate sequence', () => {
    const seam = setup()
    const frame = {
      v: 1,
      workflow_id: WORKFLOW_ID,
      seq: 1,
      update_b64: encodeBase64(hostUpdate())
    }
    seam.transport.deliver('doc_update', frame)
    seam.transport.deliver('doc_update', frame)

    expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toHaveLength(1)
    expect(seam.createLayout).toHaveBeenCalledTimes(1)
    seam.adapter.destroy()
    seam.bridge.destroy()
    seam.client.destroy()
  })
})
