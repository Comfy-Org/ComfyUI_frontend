import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { CANVAS_CLIPBOARD_ID_KEY } from '@/lib/litegraph/src/canvas/clipboardStorage'
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
  it.for(['copySelection', 'duplicateSelection'] as const)(
    '%s reports blocked storage without changing the graph or selection',
    (command) => {
      const { graph, node, canvas } = createSelection()
      blockStorage()

      useSelectionOperations()[command]()

      expect(graph.nodes).toEqual([node])
      expect([...canvas.selectedItems]).toEqual([node])
      expect(useToast().toasts).toMatchObject([{ kind: 'error' }])
    }
  )

  it('confirms a stored copy', () => {
    createSelection()

    useSelectionOperations().copySelection()

    expect(useToast().toasts).toMatchObject([{ kind: 'success' }])
  })

  it('duplicates the current selection when only the stamp write fails', () => {
    const { graph, canvas } = createSelection()
    const setItem = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation((key, value) => {
        if (key === CANVAS_CLIPBOARD_ID_KEY)
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        Storage.prototype.setItem.call(localStorage, key, value)
      })
    onTestFinished(() => setItem.mockRestore())

    useSelectionOperations().duplicateSelection()

    expect(graph.nodes).toHaveLength(2)
    expect([...canvas.selectedItems].map((item) => item.id)).toEqual(['2'])
    expect(useToast().toasts).toEqual([])
  })
})
