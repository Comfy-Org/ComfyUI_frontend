import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import {
  CANVAS_CLIPBOARD_ID_KEY,
  CANVAS_CLIPBOARD_KEY
} from '@/lib/litegraph/src/canvas/clipboardStorage'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/services/dialogService'))

function createSelection() {
  const graph = createTestRootGraph()
  const node = createTestNode(graph)
  const canvas = createTestCanvas(graph, createMockCanvasRenderingContext2D())
  canvas.selectItems([node])
  app.canvas = canvas
  const rootGraph = vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
  onTestFinished(() => rootGraph.mockRestore())
  return { graph, node, canvas }
}

function blockStorage() {
  const methods = ['getItem', 'setItem', 'removeItem'] as const
  const spies = methods.map((method) =>
    vi.spyOn(window.localStorage, method).mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
  )
  onTestFinished(() => {
    for (const spy of spies) spy.mockRestore()
  })
}

describe('selection clipboard commands', () => {
  it('reports blocked storage on copy without changing the graph or selection', () => {
    const { graph, node, canvas } = createSelection()
    blockStorage()

    useSelectionOperations().copySelection()

    expect(graph.nodes).toEqual([node])
    expect([...canvas.selectedItems]).toEqual([node])
    expect(useToast().toasts).toMatchObject([{ kind: 'error' }])
  })

  it('confirms a stored copy', () => {
    const { node } = createSelection()

    useSelectionOperations().copySelection()

    expect(
      JSON.parse(localStorage.getItem(CANVAS_CLIPBOARD_KEY) ?? 'null')
    ).toMatchObject({ nodes: [{ id: Number(node.id), type: node.type }] })
    expect(useToast().toasts).toMatchObject([{ kind: 'success' }])
  })

  it('duplicates at the pointer with storage blocked and selects only the duplicate', () => {
    const { graph, node, canvas } = createSelection()
    node.pos = [40, 80]
    canvas.graph_mouse[0] = 235
    canvas.graph_mouse[1] = 410
    blockStorage()

    useSelectionOperations().duplicateSelection()

    expect(
      graph.nodes.map((item) => ({ id: item.id, pos: [...item.pos] }))
    ).toEqual([
      { id: '1', pos: [40, 80] },
      { id: '2', pos: [235, 410] }
    ])
    expect([...canvas.selectedItems]).toEqual([graph.nodes[1]])
    expect(useToast().toasts).toEqual([])
  })

  it('leaves the previous clipboard copy intact when duplicating', () => {
    const { graph, node, canvas } = createSelection()
    node.title = 'Current selection'
    localStorage.setItem(CANVAS_CLIPBOARD_KEY, '{"nodes":[]}')
    localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, 'previous-copy')

    useSelectionOperations().duplicateSelection()

    expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBe('{"nodes":[]}')
    expect(localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)).toBe('previous-copy')
    expect(
      graph.nodes.map((item) => ({ id: item.id, title: item.title }))
    ).toEqual([
      { id: '1', title: 'Current selection' },
      { id: '2', title: 'Current selection' }
    ])
    expect([...canvas.selectedItems]).toEqual([graph.nodes[1]])
  })
})
