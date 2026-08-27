import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkflowNode } from '@comfyorg/comfy-multi-player'

import type { GraphOperation } from './graphOperations'
import { AGENT_REMOTE_ACTOR, attachLayoutMintPort } from './layoutMintPort'
import type { LayoutChangeView, LayoutMintPort } from './layoutMintPort'

const LOCAL_PREFIX = 'user-'
const LOCAL_ACTOR = 'user-abc123def'

function createNodeChange(
  id: string,
  actor: string = LOCAL_ACTOR
): LayoutChangeView {
  return {
    operation: {
      type: 'createNode',
      actor,
      nodeId: id,
      layout: { position: { x: 128, y: 96 } }
    }
  }
}

function clearChange(actor: string = LOCAL_ACTOR): LayoutChangeView {
  return { operation: { type: 'clearGraph', actor } }
}

describe('attachLayoutMintPort', () => {
  let minted: GraphOperation[]
  let port: LayoutMintPort
  let enabled: boolean
  let bound: boolean
  let graphNodes: Map<string, WorkflowNode>
  let listeners: Set<(change: LayoutChangeView) => void>

  function deliver(change: LayoutChangeView): void {
    for (const listener of listeners) listener(change)
  }

  beforeEach(() => {
    minted = []
    enabled = true
    bound = true
    listeners = new Set()
    graphNodes = new Map([
      ['1', { id: 1, type: 'TestNode', pos: [128, 96], widgets_values: [7] }]
    ])
    port = attachLayoutMintPort({
      changes: {
        onChange: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      },
      localActorPrefix: LOCAL_PREFIX,
      isEnabled: () => enabled,
      isDocBound: () => bound,
      source: {
        serializeNode: (id) => graphNodes.get(id) ?? null,
        nodeIds: () => [...graphNodes.keys()]
      },
      enqueue: (operations) => minted.push(...operations)
    })
  })

  it('mints add_node with the mint-time snapshot for a local createNode', () => {
    deliver(createNodeChange('1'))

    expect(minted).toEqual([
      {
        op: 'add_node',
        node_id: '1',
        class_type: 'TestNode',
        pos: [128, 96],
        node: { id: 1, type: 'TestNode', pos: [128, 96], widgets_values: [7] }
      }
    ])
  })

  it('never mints an agent-remote echo (KA-6 sender half)', () => {
    deliver(createNodeChange('1', AGENT_REMOTE_ACTOR))

    expect(minted).toEqual([])
  })

  it('never mints an actor-less change (no call-carried provenance)', () => {
    const change = createNodeChange('1')
    delete change.operation.actor
    deliver(change)

    expect(minted).toEqual([])
  })

  it('never mints with the product flag off', () => {
    enabled = false
    deliver(createNodeChange('1'))

    expect(minted).toEqual([])
  })

  it('never mints without a bound doc', () => {
    bound = false
    deliver(createNodeChange('1'))

    expect(minted).toEqual([])
  })

  it('never mints inside a graph-teardown bracket', () => {
    port.beginGraphTeardown()
    deliver(createNodeChange('1'))
    port.endGraphTeardown()

    expect(minted).toEqual([])
  })

  it('mints again after the teardown bracket closes', () => {
    port.beginGraphTeardown()
    port.endGraphTeardown()
    deliver(createNodeChange('1'))

    expect(minted).toHaveLength(1)
  })

  it('drops a snapshot-less mint observably, never silently', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    graphNodes.clear()
    deliver(createNodeChange('1'))

    expect(minted).toEqual([])
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('treats a bare clearGraph as teardown (a tab switch mints no clear storm)', () => {
    deliver(clearChange())

    expect(minted).toEqual([])
  })

  it('mints clear with the pre-captured node set for an intentional clear', () => {
    port.runIntentionalClear(() => {
      graphNodes.clear()
      deliver(clearChange())
    })

    expect(minted).toEqual([{ op: 'clear', removed_nodes: ['1'] }])
  })

  it('drops the intentional-clear capture if no clear reaches the store', async () => {
    port.runIntentionalClear(() => {})
    await Promise.resolve()

    deliver(clearChange())

    expect(minted).toEqual([])
  })

  it('stops minting after detach', () => {
    port.detach()
    deliver(createNodeChange('1'))

    expect(minted).toEqual([])
  })
})
