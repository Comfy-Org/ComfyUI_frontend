import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useRefreshableSelection } from '@/composables/useRefreshableSelection'

const mockCanvasStore = reactive({
  selectedItems: [] as unknown[]
})

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore
}))

function makeNode(widgets?: unknown[]): LGraphNode {
  const node = new LGraphNode('Test')
  node.widgets = widgets as LGraphNode['widgets']
  return node
}

describe('useRefreshableSelection', () => {
  beforeEach(() => {
    mockCanvasStore.selectedItems = []
  })

  it('does nothing when no selected widget is refreshable', async () => {
    const selection = useRefreshableSelection()

    await selection.refreshSelected()

    expect(selection.isRefreshable.value).toBe(false)
  })

  it('refreshes selected widgets that expose a refresh function', async () => {
    const refresh = vi.fn()
    const ignoredRefresh = vi.fn()
    mockCanvasStore.selectedItems = [
      makeNode([{ refresh }, { refresh: 'not callable' }, null]),
      { widgets: [{ refresh: ignoredRefresh }] }
    ]

    const selection = useRefreshableSelection()
    await nextTick()

    expect(selection.isRefreshable.value).toBe(true)

    await selection.refreshSelected()

    expect(refresh).toHaveBeenCalledOnce()
    expect(ignoredRefresh).not.toHaveBeenCalled()
  })

  it('treats selected nodes without widgets as not refreshable', async () => {
    mockCanvasStore.selectedItems = [makeNode()]

    const selection = useRefreshableSelection()
    await nextTick()

    expect(selection.isRefreshable.value).toBe(false)
  })
})
