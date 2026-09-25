import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toNodeId } from '@/types/nodeId'

import type { SemanticPlacementPort } from './graphMutations'
import { createGraphMutations } from './graphMutations'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

const scope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}

const context: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-ghost'
}

const GHOST_NODE_ID = 9

// This suite only asserts node flags; nothing here reads placement geometry.
const placement: SemanticPlacementPort = {
  nodeBounds: () => null,
  viewportBounds: () => null
}

/**
 * The workflow-JSON snapshot the document holds for a node the user added
 * through the v2 search box with FollowCursor on. `LGraph.add` sets
 * `flags.ghost` before `attachNodeLayout` fires the layout change that
 * `layoutMintPort` turns into `add_node`, so the snapshot that reaches the
 * document is taken while placement is still live and carries the flag.
 */
function ghostPlacedNode() {
  return {
    id: GHOST_NODE_ID,
    type: 'CLIPTextEncode',
    title: 'CLIP Text Encode (Prompt)',
    pos: [5503, 31],
    size: [400, 200],
    flags: { ghost: true },
    inputs: [{ name: 'clip', type: 'CLIP', link: null }],
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [] }],
    properties: {},
    widgets_values: {}
  }
}

describe('ghost placement flag across a follower reconcile', () => {
  const createLayout = vi.fn()
  const deleteLayouts = vi.fn()

  beforeEach(() => {
    createLayout.mockReset()
    deleteLayouts.mockReset()
    mockReportError.mockReset()
  })

  function mutations() {
    return createGraphMutations({
      getScope: () => scope,
      layout: { createNode: createLayout, deleteNodes: deleteLayouts },
      placement
    })
  }

  it('leaves flags.ghost off a node the user already placed', () => {
    const graph = mutations()
    const nodeStore = useNodeDataStore()

    expect(graph.addNode(ghostPlacedNode(), context)).toBe(true)

    const live = nodeStore.getNode(scope.rootGraphId, toNodeId(GHOST_NODE_ID))
    assert(live)

    // Clicking to place the node runs `finalizeGhostPlacement(false)`, which
    // deletes the flag from the live node. No wire op carries that deletion:
    // the three mint ports cover createNode/deleteNode/clearGraph, links and
    // widgets, so a node scalar-field change never reaches the document.
    delete live.flags.ghost

    // Any later full reconcile re-reads every node from the document, whose
    // copy still says `ghost: true`.
    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNode(ghostPlacedNode())
      })
    ).toBe(true)

    expect(
      nodeStore.getNode(scope.rootGraphId, toNodeId(GHOST_NODE_ID))?.flags.ghost
    ).toBeUndefined()
  })

  it('keeps flags.ghost on a node still being placed when its own accepted add echoes back', () => {
    const graph = mutations()
    const nodeStore = useNodeDataStore()

    expect(graph.addNode(ghostPlacedNode(), context)).toBe(true)

    // `LGraph.add` sets `flags.ghost` on the live node directly, outside
    // this module, before `attachNodeToStores` mirrors it into the same
    // reactive `NodeState` `addNode` above just registered. Reproduce that
    // here rather than through `addNode`'s own payload, since `addNode`
    // shares `prepareNode`'s `cloneNodeFlags` strip with every other path.
    const live = nodeStore.getNode(scope.rootGraphId, toNodeId(GHOST_NODE_ID))
    assert(live)
    live.flags.ghost = true

    // The mint strips `ghost` before the op reaches the document (see
    // `layoutMintPort.ts`'s `withoutGhostFlag`), so the host's accepted-add
    // echo reconciles from a snapshot that never carried the flag. The user
    // has not clicked to place the node yet — `flags.ghost` on the live node
    // is still the only record that placement is in progress, and a
    // same-id, same-type reconcile must not read it as settled early.
    expect(
      graph.batch(context, (batch) => {
        batch.reconcileNode({ ...ghostPlacedNode(), flags: {} })
      })
    ).toBe(true)

    expect(
      nodeStore.getNode(scope.rootGraphId, toNodeId(GHOST_NODE_ID))?.flags.ghost
    ).toBe(true)
  })
})
