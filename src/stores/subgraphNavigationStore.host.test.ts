import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { LGraph, Subgraph } from '@comfyorg/litegraph/litegraph'
import { LGraphCanvas } from '@comfyorg/litegraph/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@comfyorg/litegraph/subgraph/__fixtures__/subgraphHelpers'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { stubCanvasGetContext } from '@comfyorg/litegraph/__fixtures__/canvasTestUtils'

vi.mock(import('@/scripts/app'))
vi.mock<unknown>(import('vue-router'), () => ({
  NavigationFailureType: { cancelled: 8, duplicated: 16 },
  isNavigationFailure: vi.fn(() => false),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    options: { history: { state: {} } }
  })
}))
vi.mock(import('@vueuse/router'), async () => {
  const { ref } = await import('vue')
  return { useRouteHash: () => ref('') }
})

function addTwoHosts(subgraph: Subgraph) {
  const a = createTestSubgraphNode(subgraph, { id: 11 })
  const b = createTestSubgraphNode(subgraph, { id: 29 })
  subgraph.rootGraph.add(a)
  subgraph.rootGraph.add(b)
  return { a, b }
}

async function showOnCanvas(root: LGraph) {
  stubCanvasGetContext()
  const canvas = new LGraphCanvas(document.createElement('canvas'), root, {
    skip_render: true,
    skip_events: true
  })
  useCanvasStore().canvas = canvas
  vi.spyOn(app, 'canvasOrUndefined', 'get').mockReturnValue(canvas)
  canvas.canvas.addEventListener('litegraph:set-graph', () =>
    useWorkflowStore().updateActiveGraph()
  )
  useSubgraphNavigationStore()
  await nextTick()
  return { canvas, store: useSubgraphNavigationStore() }
}

describe('subgraph navigation current host', () => {
  it('keeps ambiguous direct entry unresolved', async () => {
    const subgraph = createTestSubgraph()
    addTwoHosts(subgraph)
    const { canvas, store } = await showOnCanvas(subgraph.rootGraph)

    canvas.setGraph(subgraph)

    expect(store.currentHost).toBeUndefined()
  })

  it('does not silently redirect editing to another host after the selected host is removed', async () => {
    const subgraph = createTestSubgraph()
    const { b } = addTwoHosts(subgraph)
    const root = subgraph.rootGraph
    const { canvas, store } = await showOnCanvas(root)
    canvas.openSubgraph(subgraph, b)

    root.remove(b)

    expect(store.currentHost).toBeUndefined()
  })

  it('keeps the outer host after returning from a nested subgraph', async () => {
    const outer = createTestSubgraph({ name: 'outer' })
    const root = outer.rootGraph
    const nested = createTestSubgraph({ name: 'nested', rootGraph: root })
    root.subgraphs.set(outer.id, outer)
    root.subgraphs.set(nested.id, nested)
    const { b } = addTwoHosts(outer)
    const inner = createTestSubgraphNode(nested, { id: 5, parentGraph: outer })
    outer.add(inner)
    const { canvas, store } = await showOnCanvas(root)

    canvas.openSubgraph(outer, b)
    canvas.openSubgraph(nested, inner)
    expect(store.currentHost?.id).toBe(inner.id)

    canvas.setGraph(outer)
    expect(store.currentHost?.id).toBe(b.id)
  })

  it('edits the nested instance entered through when the definition also has a root instance', async () => {
    const outer = createTestSubgraph({ name: 'outer' })
    const root = outer.rootGraph
    const nested = createTestSubgraph({ name: 'nested', rootGraph: root })
    root.subgraphs.set(outer.id, outer)
    root.subgraphs.set(nested.id, nested)
    const outerHost = createTestSubgraphNode(outer, { id: 3 })
    root.add(outerHost)
    root.add(createTestSubgraphNode(nested, { id: 7 }))
    const inner = createTestSubgraphNode(nested, { id: 5, parentGraph: outer })
    outer.add(inner)
    const { canvas, store } = await showOnCanvas(root)

    canvas.openSubgraph(outer, outerHost)
    canvas.openSubgraph(nested, inner)

    expect(store.currentHost).toMatchObject({ graphId: outer.id, id: inner.id })
  })
})
