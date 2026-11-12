import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'

describe('subgraph input values instance selection', () => {
  it('keeps ambiguous direct entry unresolved', () => {
    const subgraph = createTestSubgraph()
    const a = createTestSubgraphNode(subgraph, { id: 11 })
    const b = createTestSubgraphNode(subgraph, { id: 29 })
    const root = subgraph.rootGraph
    root.add(a)
    root.add(b)
    const canvasStore = useCanvasStore()
    canvasStore.currentGraph = subgraph
    const store = useSubgraphInputValuesStore()

    expect(store.selected).toBeUndefined()
  })

  it('uses the explicit opened instance event rather than the first candidate', () => {
    const subgraph = createTestSubgraph()
    const a = createTestSubgraphNode(subgraph, { id: 11 })
    const b = createTestSubgraphNode(subgraph, { id: 29 })
    const root = subgraph.rootGraph
    root.add(a)
    root.add(b)
    stubCanvasGetContext()
    onTestFinished(() =>
      vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore()
    )
    const canvas = new LGraphCanvas(document.createElement('canvas'), root, {
      skip_render: true,
      skip_events: true
    })
    const canvasStore = useCanvasStore()
    canvasStore.canvas = canvas
    canvasStore.currentGraph = root
    const store = useSubgraphInputValuesStore()

    canvasStore.currentGraph = subgraph
    canvas.canvas.dispatchEvent(
      new CustomEvent('subgraph-opened', {
        detail: { subgraph, closingGraph: root, fromNode: b }
      })
    )
    expect(store.selected?.id).toBe(b.id)
  })

  it('does not silently redirect editing to another host after the selected host is removed', () => {
    const subgraph = createTestSubgraph()
    const a = createTestSubgraphNode(subgraph, { id: 11 })
    const b = createTestSubgraphNode(subgraph, { id: 29 })
    const root = subgraph.rootGraph
    root.add(a)
    root.add(b)
    stubCanvasGetContext()
    onTestFinished(() =>
      vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore()
    )
    const canvas = new LGraphCanvas(document.createElement('canvas'), root, {
      skip_render: true,
      skip_events: true
    })
    const canvasStore = useCanvasStore()
    canvasStore.canvas = canvas
    canvasStore.currentGraph = root
    const store = useSubgraphInputValuesStore()
    canvasStore.currentGraph = subgraph
    canvas.canvas.dispatchEvent(
      new CustomEvent('subgraph-opened', {
        detail: { subgraph, closingGraph: root, fromNode: b }
      })
    )

    document.createElement('div').append(canvas.canvas)
    root.remove(b)
    expect(store.selected).toBeUndefined()
  })

  it('keeps the outer host after returning from a nested subgraph', async () => {
    const outer = createTestSubgraph({ name: 'outer' })
    const root = outer.rootGraph
    const nested = createTestSubgraph({ name: 'nested', rootGraph: root })
    root.subgraphs.set(outer.id, outer)
    root.subgraphs.set(nested.id, nested)
    const a = createTestSubgraphNode(outer, { id: 11 })
    const b = createTestSubgraphNode(outer, { id: 29 })
    root.add(a)
    root.add(b)
    const inner = createTestSubgraphNode(nested, { id: 5, parentGraph: outer })
    outer.add(inner)
    stubCanvasGetContext()
    onTestFinished(() =>
      vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore()
    )
    const canvas = new LGraphCanvas(document.createElement('canvas'), root, {
      skip_render: true,
      skip_events: true
    })
    const canvasStore = useCanvasStore()
    canvasStore.canvas = canvas
    await nextTick()
    const store = useSubgraphInputValuesStore()

    canvas.openSubgraph(outer, b)
    canvas.openSubgraph(nested, inner)
    expect(store.selected?.id).toBe(inner.id)

    canvas.setGraph(outer)
    expect(store.selected?.id).toBe(b.id)
  })
})
