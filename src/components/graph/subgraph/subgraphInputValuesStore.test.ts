import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'

describe('subgraph input values instance selection', () => {
  it('keeps ambiguous direct entry unresolved until an explicit instance is selected', () => {
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
    expect(store.candidates.map((node) => node.id)).toEqual([a.id, b.id])
    const selected = store.candidates.find((node) => node.id === b.id)
    assert.exists(selected)
    store.selectHost(selected)
    expect(store.selected?.id).toBe(b.id)
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
    useCanvasStore().currentGraph = subgraph
    const store = useSubgraphInputValuesStore()
    const selected = store.candidates.find((node) => node.id === b.id)
    assert.exists(selected)
    store.selectHost(selected)

    root.remove(b)
    expect(store.selected).toBeUndefined()
    expect(store.candidates.map((node) => node.id)).toEqual([a.id])
  })
})
