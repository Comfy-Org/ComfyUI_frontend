import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installNodeOutputClearingHooks } from '@/composables/graph/useNodeOutputClearingHooks'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

function seedOutputForLocator(locatorId: string) {
  app.nodeOutputs[locatorId] = {
    images: [{ filename: 'preview.png', type: 'output', subfolder: '' }]
  }
}

describe('installNodeOutputClearingHooks', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('removes outputs for a root-level node when it is removed from the graph', () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    const node = new LGraphNode('LoadImage')
    graph.add(node)

    const locatorId = String(node.id)
    seedOutputForLocator(locatorId)
    expect(app.nodeOutputs[locatorId]).toBeDefined()

    installNodeOutputClearingHooks(graph)
    graph.remove(node)

    expect(app.nodeOutputs[locatorId]).toBeUndefined()
    expect(useNodeOutputStore().nodeOutputs[locatorId]).toBeUndefined()
  })

  it('removes outputs for a subgraph interior node using subgraphUuid:nodeId locator', () => {
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('LoadImage')
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 65 })
    const rootGraph = subgraphNode.graph as LGraph
    rootGraph.add(subgraphNode)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)

    const interiorLocator = `${subgraph.id}:${interiorNode.id}`
    seedOutputForLocator(interiorLocator)
    expect(app.nodeOutputs[interiorLocator]).toBeDefined()

    installNodeOutputClearingHooks(subgraph)
    subgraph.remove(interiorNode)

    expect(app.nodeOutputs[interiorLocator]).toBeUndefined()
  })

  it('does not affect outputs for other nodes that remain in the graph', () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    const removed = new LGraphNode('LoadImage')
    const kept = new LGraphNode('LoadImage')
    graph.add(removed)
    graph.add(kept)

    const removedLocator = String(removed.id)
    const keptLocator = String(kept.id)
    seedOutputForLocator(removedLocator)
    seedOutputForLocator(keptLocator)

    installNodeOutputClearingHooks(graph)
    graph.remove(removed)

    expect(app.nodeOutputs[removedLocator]).toBeUndefined()
    expect(app.nodeOutputs[keptLocator]).toBeDefined()
  })

  it('chains with existing onNodeRemoved callbacks', () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    let calledWith: LGraphNode | undefined
    graph.onNodeRemoved = (node) => {
      calledWith = node
    }

    const node = new LGraphNode('LoadImage')
    graph.add(node)
    seedOutputForLocator(String(node.id))

    installNodeOutputClearingHooks(graph)
    graph.remove(node)

    expect(calledWith).toBe(node)
    expect(app.nodeOutputs[String(node.id)]).toBeUndefined()
  })

  it('restores original onNodeRemoved when cleanup is called', () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    const original = () => undefined
    graph.onNodeRemoved = original

    const cleanup = installNodeOutputClearingHooks(graph)
    expect(graph.onNodeRemoved).not.toBe(original)

    cleanup()
    expect(graph.onNodeRemoved).toBe(original)
  })

  it('clears interior node outputs when a subgraph container is removed from the root graph', () => {
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('LoadImage')
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 65 })
    const rootGraph = subgraphNode.graph as LGraph
    rootGraph.add(subgraphNode)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)

    const subgraphNodeLocator = String(subgraphNode.id)
    const interiorLocator = `${subgraph.id}:${interiorNode.id}`
    seedOutputForLocator(subgraphNodeLocator)
    seedOutputForLocator(interiorLocator)

    installNodeOutputClearingHooks(rootGraph)
    rootGraph.remove(subgraphNode)

    expect(app.nodeOutputs[subgraphNodeLocator]).toBeUndefined()
    expect(app.nodeOutputs[interiorLocator]).toBeUndefined()
  })

  it('also prunes the active workflow change tracker output cache so undo cannot resurrect the entry', () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    const node = new LGraphNode('LoadImage')
    graph.add(node)
    const locator = String(node.id)
    seedOutputForLocator(locator)

    const trackerCache: Record<string, unknown> = {
      [locator]: { images: [{ filename: 'preview.png' }] }
    }
    vi.spyOn(useWorkflowStore(), 'activeWorkflow', 'get').mockReturnValue({
      changeTracker: { nodeOutputs: trackerCache }
    } as never)

    installNodeOutputClearingHooks(graph)
    graph.remove(node)

    expect(app.nodeOutputs[locator]).toBeUndefined()
    expect(trackerCache[locator]).toBeUndefined()
  })

  it('preserves the tracker cache during workflow tab switch teardown', () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    const node = new LGraphNode('LoadImage')
    graph.add(node)
    const locator = String(node.id)
    seedOutputForLocator(locator)

    const trackerCache: Record<string, unknown> = {
      [locator]: { images: [{ filename: 'preview.png' }] }
    }
    vi.spyOn(useWorkflowStore(), 'activeWorkflow', 'get').mockReturnValue({
      changeTracker: { nodeOutputs: trackerCache, _restoringState: false }
    } as never)

    installNodeOutputClearingHooks(graph)
    ChangeTracker.isLoadingGraph = true
    try {
      graph.remove(node)
    } finally {
      ChangeTracker.isLoadingGraph = false
    }

    expect(trackerCache[locator]).toBeDefined()
  })

  it('does not throw when the removal hook fires for an already-cleared node', () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    const node = new LGraphNode('LoadImage')
    graph.add(node)
    const locator = String(node.id)
    seedOutputForLocator(locator)

    installNodeOutputClearingHooks(graph)
    graph.remove(node)
    expect(() => graph.onNodeRemoved?.(node)).not.toThrow()
    expect(app.nodeOutputs[locator]).toBeUndefined()
  })
})
