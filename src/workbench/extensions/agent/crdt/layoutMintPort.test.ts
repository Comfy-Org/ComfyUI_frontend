import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkflowNode } from '@comfyorg/comfy-multi-player'

import type { GraphOperation } from './graphOperations'
import { AGENT_REMOTE_ACTOR, attachLayoutMintPort } from './layoutMintPort'
import type { LayoutChangeView, LayoutMintPort } from './layoutMintPort'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'

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

function deleteChange(
  id: string,
  actor: string = LOCAL_ACTOR
): LayoutChangeView {
  return { operation: { type: 'deleteNode', actor, nodeId: id } }
}

describe('attachLayoutMintPort', () => {
  let minted: GraphOperation[]
  let port: LayoutMintPort
  let enabled: boolean
  let bound: boolean
  let graphNodes: Map<string, WorkflowNode>
  let listeners: Set<(change: LayoutChangeView) => void>
  let session: MintSession
  let severed: Map<string, (string | number)[]>

  function deliver(change: LayoutChangeView): void {
    for (const listener of listeners) listener(change)
  }

  beforeEach(() => {
    minted = []
    enabled = true
    bound = true
    listeners = new Set()
    session = createMintSession()
    severed = new Map()
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
      session,
      severedLinks: { take: (nodeId) => severed.get(nodeId) ?? [] },
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
    session.beginGraphTeardown()
    deliver(createNodeChange('1'))
    session.endGraphTeardown()

    expect(minted).toEqual([])
  })

  it('mints again after the teardown bracket closes', () => {
    session.beginGraphTeardown()
    session.endGraphTeardown()
    deliver(createNodeChange('1'))

    expect(minted).toHaveLength(1)
  })

  it('mints delete_node carrying the severed link ids from the capture', () => {
    severed.set('1', [17, 18])
    deliver(deleteChange('1'))

    expect(minted).toEqual([
      { op: 'delete_node', node_id: '1', removed_links: [17, 18] }
    ])
  })

  it('mints delete_node with no severances as an empty removed_links', () => {
    deliver(deleteChange('1'))

    expect(minted).toEqual([
      { op: 'delete_node', node_id: '1', removed_links: [] }
    ])
  })

  it('never mints a teardown-bracketed or agent-remote deleteNode', () => {
    session.beginGraphTeardown()
    deliver(deleteChange('1'))
    session.endGraphTeardown()
    deliver(deleteChange('2', AGENT_REMOTE_ACTOR))

    expect(minted).toEqual([])
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

  it.for([
    'moveNode',
    'resizeNode',
    'setNodeZIndex',
    'batchUpdateBounds',
    'createReroute',
    'deleteReroute',
    'moveReroute',
    'createGroup',
    'setGroupBounds',
    'deleteGroup'
  ] as const)('never mints the non-semantic %s operation', (type) => {
    deliver({
      operation: {
        type,
        actor: LOCAL_ACTOR,
        nodeId: '1',
        layout: { position: { x: 1, y: 2 } }
      }
    })
    expect(minted).toEqual([])
  })

  it('stops minting after detach', () => {
    port.detach()
    deliver(createNodeChange('1'))

    expect(minted).toEqual([])
  })
})
