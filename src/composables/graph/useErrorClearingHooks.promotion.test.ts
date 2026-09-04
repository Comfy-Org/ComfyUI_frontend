import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installErrorClearingHooks } from '@/composables/graph/useErrorClearingHooks'
import { ChangeTracker } from '@/scripts/changeTracker'
import {
  demoteWidget,
  promoteValueWidgetViaSubgraphInput
} from '@/core/graph/subgraph/promotionUtils'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import {
  createMissingMediaCandidate,
  seedMediaNodeDefs
} from '@/platform/missingMedia/__fixtures__/promotedMedia'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { app } from '@/scripts/app'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

function stubRootGraph(graph: LGraph) {
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
  vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(true)
}

describe('link ownership error surface', () => {
  beforeEach(() => {
    seedMediaNodeDefs()
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('drops the candidate when the media input becomes link-fed and restores it when unlinked', async () => {
    const graph = new LGraph()
    const upstream = new LGraphNode('ImageSource')
    upstream.addOutput('image', 'COMBO')
    graph.add(upstream)

    const node = new LGraphNode('LoadImage', 'LoadImage')
    const input = node.addInput('image', 'COMBO')
    const widget = node.addWidget(
      'combo',
      'image',
      'missing.png',
      () => undefined,
      { values: [] }
    )
    input.widget = { name: widget.name }
    graph.add(node)
    stubRootGraph(graph)

    installErrorClearingHooks(graph)

    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia([createMissingMediaCandidate([node.id])])

    const link = upstream.connect(0, node, 0)
    if (!link) throw new Error('Expected media input link')

    await vi.waitFor(() => expect(mediaStore.missingMediaCandidates).toBeNull())

    node.disconnectInput(0, true)

    await vi.waitFor(() =>
      expect(mediaStore.missingMediaCandidates).toEqual([
        expect.objectContaining({
          nodeId: String(node.id),
          name: 'missing.png'
        })
      ])
    )
  })
})

describe('link ownership while a workflow loads', () => {
  beforeEach(() => {
    seedMediaNodeDefs()
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  afterEach(() => {
    ChangeTracker.isLoadingGraph = false
  })

  it('keeps cached candidates while a workflow load clears the old graph', () => {
    const graph = new LGraph()
    const node = new LGraphNode('LoadImage', 'LoadImage')
    const input = node.addInput('image', 'COMBO')
    const widget = node.addWidget(
      'combo',
      'image',
      'missing.png',
      () => undefined,
      { values: [] }
    )
    input.widget = { name: widget.name }
    graph.add(node)
    stubRootGraph(graph)

    installErrorClearingHooks(graph)

    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia([createMissingMediaCandidate([toNodeId(999)])])

    // clear() fires the removal lifecycle per node, which reaches the same
    // prune the connection path uses.
    ChangeTracker.isLoadingGraph = true
    graph.clear()

    expect(mediaStore.missingMediaCandidates).toHaveLength(1)
  })

  it('keeps restored candidates while the graph is still being wired', async () => {
    const graph = new LGraph()
    const upstream = new LGraphNode('ImageSource')
    upstream.addOutput('image', 'COMBO')
    graph.add(upstream)

    const node = new LGraphNode('LoadImage', 'LoadImage')
    const input = node.addInput('image', 'COMBO')
    const widget = node.addWidget(
      'combo',
      'image',
      'missing.png',
      () => undefined,
      { values: [] }
    )
    input.widget = { name: widget.name }
    graph.add(node)
    stubRootGraph(graph)

    installErrorClearingHooks(graph)

    // A workflow load restores cached candidates, then configure() replays a
    // connection change for every input slot.
    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia([createMissingMediaCandidate([toNodeId(999)])])
    ChangeTracker.isLoadingGraph = true

    const link = upstream.connect(0, node, 0)
    if (!link) throw new Error('Expected media input link')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mediaStore.missingMediaCandidates).toHaveLength(1)
  })
})

describe('promotion listener lifecycle', () => {
  beforeEach(() => {
    seedMediaNodeDefs()
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  /** Lets a removal's own deferred reconcile land before the test seeds. */
  const flushRemovalReconcile = () =>
    new Promise((resolve) => setTimeout(resolve, 0))

  /** A candidate for a node that does not exist, so any reconcile drops it. */
  function seedStaleCandidate() {
    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia([
      createMissingMediaCandidate([toNodeId(999)], { name: 'stale.png' })
    ])
    return mediaStore
  }

  function createSharedDefinitionGraph(hostIds: number[]) {
    const subgraph = createTestSubgraph()
    const rootGraph = subgraph.rootGraph
    const hosts = hostIds.map((id) => {
      const host = createTestSubgraphNode(subgraph, { id })
      rootGraph.add(host)
      return host
    })
    stubRootGraph(rootGraph)
    return { subgraph, rootGraph, hosts }
  }

  it('stops reconciling a subgraph definition once its last host is removed', async () => {
    const {
      subgraph,
      rootGraph,
      hosts: [host]
    } = createSharedDefinitionGraph([65])
    installErrorClearingHooks(rootGraph)
    rootGraph.remove(host)
    await flushRemovalReconcile()

    const mediaStore = seedStaleCandidate()
    subgraph.events.dispatch('widget-promoted', {
      widget: fromPartial<IBaseWidget>({ name: 'image' }),
      subgraphNode: host
    })

    // The reconcile is deferred a microtask, so give it a turn to prove it
    // never arrives rather than reading the store before it could have run.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mediaStore.missingMediaCandidates).not.toBeNull()
  })

  it('stops reconciling after the node manager replays onNodeAdded for existing hosts', async () => {
    const {
      subgraph,
      rootGraph,
      hosts: [host]
    } = createSharedDefinitionGraph([65])
    installErrorClearingHooks(rootGraph)
    // useGraphNodeManager chains onNodeAdded and replays it for every node
    // already in the graph, so hosts counted at install time arrive again.
    rootGraph.onNodeAdded?.(host)
    rootGraph.remove(host)
    await flushRemovalReconcile()

    const mediaStore = seedStaleCandidate()
    subgraph.events.dispatch('widget-promoted', {
      widget: fromPartial<IBaseWidget>({ name: 'image' }),
      subgraphNode: host
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mediaStore.missingMediaCandidates).not.toBeNull()
  })

  it('keeps reconciling while another host still shares the definition', async () => {
    const {
      subgraph,
      rootGraph,
      hosts: [first, second]
    } = createSharedDefinitionGraph([65, 66])
    installErrorClearingHooks(rootGraph)
    rootGraph.remove(first)
    await flushRemovalReconcile()

    const mediaStore = seedStaleCandidate()
    subgraph.events.dispatch('widget-promoted', {
      widget: fromPartial<IBaseWidget>({ name: 'image' }),
      subgraphNode: second
    })

    await vi.waitFor(() => expect(mediaStore.missingMediaCandidates).toBeNull())
  })
})

describe('promoted widget promotion error surface moves with ownership', () => {
  beforeEach(() => {
    seedMediaNodeDefs()
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  function createPromotableLeaf() {
    const subgraph = createTestSubgraph()
    const rootGraph = subgraph.rootGraph
    const host = createTestSubgraphNode(subgraph, { id: 65 })
    rootGraph.add(host)

    const leafNode = new LGraphNode('LoadImage', 'LoadImage')
    leafNode.id = toNodeId(42)
    const leafInput = leafNode.addInput('image', 'COMBO')
    const leafWidget = leafNode.addWidget(
      'combo',
      'image',
      'missing.png',
      () => undefined,
      { values: [] }
    )
    leafInput.widget = { name: leafWidget.name }
    subgraph.add(leafNode)

    stubRootGraph(rootGraph)
    return { subgraph, rootGraph, host, leafNode, leafWidget }
  }

  it('moves a missing media error from the interior widget to the host on promotion', async () => {
    const { subgraph, host, leafNode, leafWidget } = createPromotableLeaf()
    installErrorClearingHooks(subgraph)

    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia([
      createMissingMediaCandidate([host.id, leafNode.id])
    ])

    expect(
      promoteValueWidgetViaSubgraphInput(host, leafNode, leafWidget).ok
    ).toBe(true)

    await vi.waitFor(() =>
      expect(mediaStore.missingMediaCandidates).toEqual([
        expect.objectContaining({
          nodeId: createNodeExecutionId([host.id]),
          widgetName: host.widgets[0].name,
          name: 'missing.png'
        })
      ])
    )
  })

  it('re-surfaces the error on the interior widget that regains ownership on demotion', async () => {
    const { subgraph, host, leafNode, leafWidget } = createPromotableLeaf()
    expect(
      promoteValueWidgetViaSubgraphInput(host, leafNode, leafWidget).ok
    ).toBe(true)
    installErrorClearingHooks(subgraph)

    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia([
      createMissingMediaCandidate([host.id], {
        widgetName: host.widgets[0].name
      })
    ])

    demoteWidget(leafNode, leafWidget, [host])

    await vi.waitFor(() =>
      expect(mediaStore.missingMediaCandidates).toEqual([
        expect.objectContaining({
          nodeId: createNodeExecutionId([host.id, leafNode.id]),
          widgetName: 'image',
          name: 'missing.png'
        })
      ])
    )
  })
})

describe('promoted widget demotion error clearing', () => {
  beforeEach(() => {
    seedMediaNodeDefs()
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('clears host-keyed missing media when its widget is demoted', () => {
    const subgraph = createTestSubgraph()
    const rootGraph = subgraph.rootGraph
    const host = createTestSubgraphNode(subgraph, { id: 65 })
    rootGraph.add(host)

    const leafNode = new LGraphNode('LoadImage', 'LoadImage')
    leafNode.id = toNodeId(42)
    const leafInput = leafNode.addInput('image', 'COMBO')
    const leafWidget = leafNode.addWidget(
      'combo',
      'image',
      'missing.png',
      () => undefined,
      { values: [] }
    )
    leafInput.widget = { name: leafWidget.name }
    subgraph.add(leafNode)

    expect(
      promoteValueWidgetViaSubgraphInput(host, leafNode, leafWidget).ok
    ).toBe(true)
    expect(host.widgets).toHaveLength(1)
    stubRootGraph(rootGraph)
    installErrorClearingHooks(subgraph)

    const mediaStore = useMissingMediaStore()
    const candidates = [
      createMissingMediaCandidate([host.id], {
        widgetName: host.widgets[0].name
      })
    ]
    mediaStore.setMissingMedia(candidates)

    demoteWidget(leafNode, leafWidget, [host])

    expect(host.widgets).toHaveLength(0)
    expect(mediaStore.missingMediaCandidates).toBeNull()
  })
})
