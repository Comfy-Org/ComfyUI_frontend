import { applyOps, mint, project } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import type { GraphOperation } from './graphOperations'
import type { LayoutChangeView } from './layoutMintPort'
import { mintWireOps } from './opEnvelope'
import { attachMintPortWiring } from './mintPortWiring'
import type { MintPortWiring, MintableGraph } from './mintPortWiring'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const ROOT_ID = 'root-uuid'
const OTHER_ROOT_ID = 'other-root-uuid'
const NODE_ID = 7

/** The doc host's pinned catalog: server classes only. */
const CATALOG: WidgetCatalog = {
  types: { LoadImage: { widget_order: ['image'] } }
}

/**
 * The document's copy of the node before the user touches it: the snapshot a
 * full reconcile re-reads and re-applies over the live node.
 */
function docNode() {
  return {
    id: NODE_ID,
    type: 'LoadImage',
    pos: [10, 20],
    size: [200, 100],
    flags: {},
    inputs: [],
    outputs: [],
    properties: {},
    widgets_values: []
  }
}

/**
 * `flags.collapsed` and `flags.pinned` are durable node state a collaborator
 * must see, but no mint port covers a scalar-field change on an existing node:
 * the three ports cover createNode/deleteNode/clearGraph, links and widgets.
 * The reconcile path nevertheless re-reads `flags` FROM the document on every
 * full resync, so a local toggle is silently reverted.
 */
describe('node flag write-back', () => {
  let minted: GraphOperation[]
  let wiring: MintPortWiring
  let enabled: boolean
  let bound: boolean
  let boundRoot: string
  let layoutListeners: Set<(change: LayoutChangeView) => void>
  let graphNodes: Map<string, LGraphNode>

  const graph: MintableGraph = {
    id: ROOT_ID,
    rootGraph: { id: ROOT_ID },
    getNodeById: (id) => graphNodes.get(String(id)) ?? null,
    get _nodes() {
      return [...graphNodes.values()]
    }
  }

  function liveNode(): LGraphNode {
    const liveGraph = new LGraph()
    liveGraph.id = ROOT_ID
    const node = new LGraphNode('Load Image', 'LoadImage')
    node.id = toNodeId(NODE_ID)
    liveGraph.add(node)
    node.pos = [10, 20]
    graphNodes.set(String(NODE_ID), node)
    minted.length = 0
    return node
  }

  beforeEach(() => {
    minted = []
    enabled = true
    bound = true
    boundRoot = ROOT_ID
    layoutListeners = new Set()
    graphNodes = new Map()
    vi.mocked(reportError).mockClear()
    wiring = attachMintPortWiring({
      isEnabled: () => enabled,
      isDocBound: () => bound,
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: (listener) => {
        layoutListeners.add(listener)
        return () => layoutListeners.delete(listener)
      },
      localActorPrefix: 'user-',
      getGraph: () => graph,
      boundRootGraphId: () => toRootGraphId(boundRoot)
    })
  })

  afterEach(() => wiring.detach())

  it.for([
    {
      flag: 'collapsed',
      toggle: (node: LGraphNode) => node.collapse(),
      field: 'flags.collapsed' as const,
      value: true
    },
    {
      flag: 'pinned',
      toggle: (node: LGraphNode) => node.pin(true),
      field: 'flags.pinned' as const,
      value: true
    }
  ])(
    'mints a local $flag toggle back into the document as set_node_field',
    ({ toggle, field, value }) => {
      toggle(liveNode())

      expect(minted).toEqual([
        {
          op: 'set_node_field',
          node_id: toNodeId(NODE_ID),
          field,
          value
        }
      ])
    }
  )

  it('mints flags.collapsed=false (not the whole node) when un-collapsing', () => {
    const node = liveNode()
    node.collapse()
    minted.length = 0

    node.collapse()

    expect(minted).toEqual([
      {
        op: 'set_node_field',
        node_id: toNodeId(NODE_ID),
        field: 'flags.collapsed',
        value: false
      }
    ])
  })

  it('leaves the toggle in the document, so a reconcile reads it back', () => {
    liveNode().collapse()

    const doc = mint({ nodes: [docNode()], links: [] }, CATALOG)
    const { outcomes } = applyOps(
      doc,
      mintWireOps(minted, { actor: 'human:user:tab', baseVersion: 1 }),
      CATALOG
    )

    expect(outcomes).toEqual([expect.objectContaining({ outcome: 'applied' })])
    const reconciled = project(doc, CATALOG).nodes.find(
      (node) => String(node.id) === String(NODE_ID)
    )
    expect(reconciled?.flags).toEqual({ collapsed: true })
    doc.destroy()
  })

  it('a concurrent remote widget write survives a local flag toggle (no whole-node clobber)', () => {
    liveNode()

    const doc = mint({ nodes: [docNode()], links: [] }, CATALOG)
    const remoteWidgetWrite = mintWireOps(
      [
        {
          op: 'set_widget',
          node_id: NODE_ID,
          widget: 'image',
          value: 'remote.png',
          old: null
        }
      ],
      { actor: 'human:other:tab', baseVersion: 1 }
    )
    applyOps(doc, remoteWidgetWrite, CATALOG)

    graphNodes.get(String(NODE_ID))?.collapse()
    const { outcomes } = applyOps(
      doc,
      mintWireOps(minted, { actor: 'human:user:tab', baseVersion: 2 }),
      CATALOG
    )

    expect(outcomes).toEqual([expect.objectContaining({ outcome: 'applied' })])
    const reconciled = project(doc, CATALOG).nodes.find(
      (node) => String(node.id) === String(NODE_ID)
    )
    expect(reconciled?.flags).toEqual({ collapsed: true })
    expect(reconciled?.widgets_values).toEqual(['remote.png'])
    doc.destroy()
  })

  it('mints nothing for an unbound workflow', () => {
    bound = false

    liveNode().collapse()

    expect(minted).toEqual([])
  })

  it('does not mint into a foreign document during a workflow-switch race (bound root differs from the live graph)', () => {
    // isDocBound() already reports the incoming workflow while the shared
    // canvas graph (and so `change.graphId`) still holds the outgoing one -
    // scoping against the LIVE graph's root, rather than the bound
    // document's own stored root, would pass this check trivially and mint
    // a foreign workflow's node into the bound doc.
    boundRoot = OTHER_ROOT_ID

    liveNode().collapse()

    expect(minted).toEqual([])
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'agent_crdt_op_for_unbound_graph' })
    )
  })

  it('reports an unbound-graph flag toggle only once per tick', async () => {
    boundRoot = OTHER_ROOT_ID
    const node = liveNode()

    node.collapse()
    node.collapse()

    expect(reportError).toHaveBeenCalledOnce()

    await Promise.resolve()
    node.collapse()
    expect(reportError).toHaveBeenCalledTimes(2)
  })

  it('mints when there is no stored bound root graph id (untracked, not restricted)', () => {
    wiring.detach()
    wiring = attachMintPortWiring({
      isEnabled: () => enabled,
      isDocBound: () => bound,
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: (listener) => {
        layoutListeners.add(listener)
        return () => layoutListeners.delete(listener)
      },
      localActorPrefix: 'user-',
      getGraph: () => graph,
      boundRootGraphId: () => null
    })

    liveNode().collapse()

    expect(minted).toEqual([
      {
        op: 'set_node_field',
        node_id: toNodeId(NODE_ID),
        field: 'flags.collapsed',
        value: true
      }
    ])
  })

  it('stops observing after detach', () => {
    const node = liveNode()
    wiring.detach()

    node.collapse()

    expect(minted).toEqual([])
  })
})
