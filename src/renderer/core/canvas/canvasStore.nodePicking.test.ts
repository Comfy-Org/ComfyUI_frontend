import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick, watch } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/canvasTestUtils'

function setup() {
  const graph = new LGraph()
  const first = new LGraphNode('First')
  first.pos = [100, 200]
  first.size = [50, 60]
  graph.add(first)
  const second = new LGraphNode('Second')
  second.pos = [300, 400]
  second.size = [80, 20]
  graph.add(second)
  const canvas = createTestCanvas(graph, createMockCanvasRenderingContext2D())
  onTestFinished(() => canvas.unbindEvents())
  const store = useCanvasStore()
  store.canvas = canvas
  const animate = vi
    .spyOn(canvas, 'animateToBounds')
    .mockImplementation(() => {})
  return { store, canvas, first, second, animate }
}

describe('canvas node picking', () => {
  it.for([
    { selectedCount: 1, bounds: [60, 160, 130, 140] },
    { selectedCount: 0, bounds: [60, 160, 360, 300] }
  ])(
    'frames positional bounds with $selectedCount selected nodes',
    ({ selectedCount, bounds }) => {
      const { store, canvas, first, animate } = setup()
      canvas.selectItems([first].slice(0, selectedCount))

      store.startNodePicking()

      expect(animate).toHaveBeenCalledWith(bounds, {
        viewport: [0, 0, 800, 600]
      })
    }
  )

  it('holds notifications for the duration of node picking', async () => {
    const { store } = setup()

    store.startNodePicking()
    await nextTick()
    expect(useToast().held).toBe(true)

    store.stopNodePicking()
    await nextTick()
    expect(useToast().held).toBe(false)
  })

  it('does not animate an empty graph', () => {
    const { store, canvas, animate } = setup()
    canvas.graph?.clear()

    store.startNodePicking()

    expect(animate).not.toHaveBeenCalled()
  })

  it('stops tracking before deselection and leaves user preferences unchanged', async () => {
    const { store, canvas, first } = setup()
    await nextTick()
    const settings = useSettingStore()
    settings.settingValues['Comfy.Minimap.Visible'] = true
    const sidebar = useSidebarTabStore()
    sidebar.activeSidebarTabId = 'assets'
    canvas.select(first)
    store.startNodePicking()
    const pickingAtDeselection: boolean[] = []
    const stop = watch(
      () => store.selectedItems,
      () => pickingAtDeselection.push(store.isPickingNodes),
      { flush: 'sync' }
    )
    onTestFinished(stop)

    store.stopNodePicking()
    await nextTick()

    expect(canvas.selectedItems.size).toBe(0)
    expect(pickingAtDeselection).toEqual([false])
    expect(settings.get('Comfy.Minimap.Visible')).toBe(true)
    expect(settings.set).not.toHaveBeenCalled()
    expect(sidebar.activeSidebarTabId).toBe('assets')

    canvas.select(first)
    store.stopNodePicking()
    expect([...canvas.selectedItems]).toEqual([first])
  })
})
