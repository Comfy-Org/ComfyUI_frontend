/**
 * The tab-switch handoff, end to end: the REAL layout store delivering
 * through the REAL mint wiring, targeted by the REAL activation host and
 * GraphDocument registry.
 *
 * The app reuses one root `LGraph` across tabs and reconfigures it in place,
 * so a switch leaves the previous tab's queued layout changes draining while
 * the graph already carries the new tab's id. These tests pin that no such
 * change can mint into a document the canvas is not showing.
 *
 * Lives in renderer (not workbench) because it imports the real layout store;
 * the wiring takes the store's seams injected, as the composition root does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { DocumentId } from '@/types/documentId'
import type { RootGraphId } from '@/types/graphScopeId'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import type {
  MintPortWiring,
  MintableGraph
} from '@/workbench/extensions/agent/crdt/mintPortWiring'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useDocumentActivationStore } from '@/stores/documentActivationStore'
import { useGraphDocumentStore } from '@/stores/graphDocumentStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { createUuidv4 } from '@/utils/uuid'
import { attachMintPortWiring } from '@/workbench/extensions/agent/crdt/mintPortWiring'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

function createNodeOp(graphId: string, id: string) {
  return {
    type: 'createNode' as const,
    graphId,
    ownerGraphId: graphId,
    nodeId: toNodeId(id),
    layout: {
      id: toNodeId(id),
      position: { x: 10, y: 20 },
      size: { width: 100, height: 60 },
      zIndex: 0,
      visible: true,
      bounds: { x: 10, y: 20, width: 100, height: 60 }
    },
    timestamp: Date.now(),
    source: LayoutSource.Canvas
  }
}

async function realDelivery(): Promise<void> {
  for (let tick = 0; tick < 4; tick++) await Promise.resolve()
}

describe('tab-switch activation handoff', () => {
  let minted: GraphOperation[]
  let wiring: MintPortWiring
  let documents: ReturnType<typeof useGraphDocumentStore>
  let activation: ReturnType<typeof useDocumentActivationStore>
  /** The one shared root graph the app reconfigures in place across tabs. */
  let sharedGraph: MintableGraph
  let tabA: { documentId: DocumentId; rootGraphId: RootGraphId }
  let tabB: { documentId: DocumentId; rootGraphId: RootGraphId }
  let nodes: Map<string, LGraphNode>

  function openTab(): { documentId: DocumentId; rootGraphId: RootGraphId } {
    const documentId = documents.createDocument()
    if (documentId === null) throw new Error('registry refused the document')
    return { documentId, rootGraphId: toRootGraphId(createUuidv4()) }
  }

  /** What `app.loadGraphData` does: retract, reconfigure in place, activate. */
  async function switchTo(tab: {
    documentId: DocumentId
    rootGraphId: RootGraphId
  }): Promise<void> {
    activation.deactivate()
    sharedGraph.id = tab.rootGraphId
    sharedGraph.rootGraph = { id: tab.rootGraphId }
    // The load path loads the document before asking for the canvas; the
    // activation request does not promote it on its own.
    documents.markLoaded(tab.documentId)
    await activation.activate(tab.documentId, {
      rootGraphId: tab.rootGraphId,
      owningGraphId: toOwningGraphId(tab.rootGraphId)
    })
  }

  function addNode(id: string): void {
    nodes.set(
      id,
      createMockLGraphNode({
        id: toNodeId(id),
        serialize: () => ({ id: Number(id), type: 'TestNode' })
      })
    )
  }

  beforeEach(() => {
    minted = []
    nodes = new Map()
    documents = useGraphDocumentStore()
    activation = useDocumentActivationStore()
    tabA = openTab()
    tabB = openTab()
    sharedGraph = {
      id: tabA.rootGraphId,
      rootGraph: { id: tabA.rootGraphId },
      getNodeById: (id) => nodes.get(String(id)) ?? null,
      get _nodes() {
        return [...nodes.values()]
      }
    }
    wiring = attachMintPortWiring({
      isEnabled: () => true,
      isDocBound: () => true,
      activeRootGraphId: () => activation.activeRootGraphId(),
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: (listener) => layoutStore.onChange(listener),
      localActorPrefix: 'user-',
      getGraph: () => sharedGraph
    })
  })

  afterEach(() => {
    wiring.detach()
  })

  it('activates the incoming tab and deactivates the outgoing one', async () => {
    await switchTo(tabA)
    expect(activation.activeDocumentId()).toBe(tabA.documentId)

    await switchTo(tabB)

    expect(activation.activeDocumentId()).toBe(tabB.documentId)
    expect(activation.activeRootGraphId()).toBe(tabB.rootGraphId)
  })

  it('mints a human edit on the activated tab', async () => {
    await switchTo(tabA)
    addNode('5')

    layoutStore.applyOperation(createNodeOp(tabA.rootGraphId, '5'))
    await realDelivery()

    expect(minted).toEqual([
      {
        op: 'add_node',
        node_id: toNodeId('5'),
        class_type: 'TestNode',
        pos: [10, 20],
        node: { id: 5, type: 'TestNode' }
      }
    ])
  })

  it('a change that drains after the switch never reaches the previous document', async () => {
    await switchTo(tabA)
    addNode('7')

    // The #18109 race: the incoming tab's nodes are attached to the shared
    // graph while the previous tab's document is still the bound one, and
    // the queued createNode flushes on a later microtask. Retracting the
    // binding first is what makes the flush unable to name tab A.
    activation.deactivate()
    sharedGraph.id = tabB.rootGraphId
    sharedGraph.rootGraph = { id: tabB.rootGraphId }
    layoutStore.applyOperation(createNodeOp(tabB.rootGraphId, '7'))
    await realDelivery()

    expect(minted).toEqual([])
  })

  it('a stale change for the previous graph is dropped once the new tab is active', async () => {
    await switchTo(tabA)
    await switchTo(tabB)
    addNode('9')

    layoutStore.applyOperation(createNodeOp(tabA.rootGraphId, '9'))
    await realDelivery()

    expect(minted).toEqual([])
  })

  it('rapid switching leaves exactly the last tab holding the canvas', async () => {
    await switchTo(tabA)

    documents.markLoaded(tabB.documentId)
    const races = [
      activation.activate(tabA.documentId, {
        rootGraphId: tabA.rootGraphId,
        owningGraphId: toOwningGraphId(tabA.rootGraphId)
      }),
      activation.activate(tabB.documentId, {
        rootGraphId: tabB.rootGraphId,
        owningGraphId: toOwningGraphId(tabB.rootGraphId)
      })
    ]
    await Promise.all(races)

    expect(activation.activeDocumentId()).toBe(tabB.documentId)
    expect(activation.activeRootGraphId()).toBe(tabB.rootGraphId)

    sharedGraph.id = tabB.rootGraphId
    sharedGraph.rootGraph = { id: tabB.rootGraphId }
    addNode('11')
    layoutStore.applyOperation(createNodeOp(tabA.rootGraphId, '11'))
    await realDelivery()

    expect(minted).toEqual([])
  })

  it('refuses the canvas to a document no load path ever loaded', async () => {
    const outcome = await activation.activate(tabA.documentId, {
      rootGraphId: tabA.rootGraphId,
      owningGraphId: toOwningGraphId(tabA.rootGraphId)
    })

    expect(outcome).toEqual({
      status: 'rejected',
      documentId: tabA.documentId,
      reason: 'not-loaded'
    })
    expect(activation.activeRootGraphId()).toBeNull()
    expect(documents.getDocument(tabA.documentId)?.scope).toBeNull()
  })

  it('keeps minting after a clear reminted the root graph id in place', async () => {
    await switchTo(tabA)
    // `app.clean()`: `LGraph.clear()` remints the root id under the same
    // document and the host rebinds onto it. Without that rebind every later
    // edit names a graph the activated document no longer owns.
    const reminted = toRootGraphId(createUuidv4())
    sharedGraph.id = reminted
    sharedGraph.rootGraph = { id: reminted }
    activation.rebindActiveScope({
      rootGraphId: reminted,
      owningGraphId: toOwningGraphId(reminted)
    })
    addNode('13')

    layoutStore.applyOperation(createNodeOp(reminted, '13'))
    await realDelivery()

    expect(minted).toHaveLength(1)
    expect(documents.getDocument(tabA.documentId)?.scope).toEqual({
      rootGraphId: reminted,
      owningGraphId: toOwningGraphId(reminted)
    })
  })

  it('the registry learns each tab’s scope from the activation, not from a later write', async () => {
    await switchTo(tabA)
    await switchTo(tabB)

    expect(documents.getDocument(tabA.documentId)?.scope).toEqual({
      rootGraphId: tabA.rootGraphId,
      owningGraphId: toOwningGraphId(tabA.rootGraphId)
    })
    expect(documents.getDocument(tabB.documentId)?.scope).toEqual({
      rootGraphId: tabB.rootGraphId,
      owningGraphId: toOwningGraphId(tabB.rootGraphId)
    })
  })
})
