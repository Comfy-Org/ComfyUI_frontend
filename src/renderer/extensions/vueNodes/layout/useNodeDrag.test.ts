import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeDrag } from '@/renderer/extensions/vueNodes/layout/useNodeDrag'
import type * as VueUseModule from '@vueuse/core'

const settingValues: Record<string, boolean | number> = {
  'Comfy.Canvas.AlignNodesWhileDragging': false,
  'Comfy.SnapToGrid.GridSize': 10,
  'pysssss.SnapToGrid': false
}

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof VueUseModule>('@vueuse/core')

  return {
    ...actual,
    createSharedComposable: <TArgs extends unknown[], TResult>(
      composable: (...args: TArgs) => TResult
    ) => composable
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => settingValues[key]
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: null
  }
}))

describe('useNodeDrag', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    layoutStore.initializeFromLiteGraph([
      { id: 'node-1', pos: [0, 40], size: [100, 60] },
      { id: 'node-2', pos: [40, 40], size: [100, 60] },
      { id: 'node-3', pos: [200, 40], size: [100, 60] }
    ])
    layoutStore.vueDragSnapGuides.value = []
    layoutStore.isDraggingVueNodes.value = false

    LiteGraph.NODE_TITLE_HEIGHT = 30

    const canvasStore = useCanvasStore()
    canvasStore.selectedItems = [{ id: 'node-1' }, { id: 'node-2' }] as never[]
    canvasStore.canvas = {
      setDirty: vi.fn()
    } as never

    settingValues['Comfy.Canvas.AlignNodesWhileDragging'] = false
    settingValues['pysssss.SnapToGrid'] = false

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  it('snaps the dragged multi-selection and clears guides on drag end', () => {
    settingValues['Comfy.Canvas.AlignNodesWhileDragging'] = true

    const { startDrag, handleDrag, endDrag } = useNodeDrag()

    startDrag(
      new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }),
      'node-1'
    )
    handleDrag(
      new PointerEvent('pointermove', {
        clientX: 193,
        clientY: 0
      }),
      'node-1'
    )

    expect(layoutStore.getNodeLayoutRef('node-1').value?.position.x).toBe(200)
    expect(layoutStore.getNodeLayoutRef('node-2').value?.position.x).toBe(240)
    expect(layoutStore.vueDragSnapGuides.value).toContainEqual(
      expect.objectContaining({
        axis: 'vertical',
        coordinate: 200
      })
    )

    endDrag(
      new PointerEvent('pointerup', { clientX: 193, clientY: 0 }),
      'node-1'
    )

    expect(layoutStore.vueDragSnapGuides.value).toEqual([])
  })

  it('excludes already selected nodes from alignment candidates', () => {
    settingValues['Comfy.Canvas.AlignNodesWhileDragging'] = true

    layoutStore.initializeFromLiteGraph([
      { id: 'node-1', pos: [0, 40], size: [100, 60] },
      { id: 'node-2', pos: [60, 40], size: [100, 60] }
    ])

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(
      new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }),
      'node-1'
    )
    handleDrag(
      new PointerEvent('pointermove', {
        clientX: 63,
        clientY: 0
      }),
      'node-1'
    )

    expect(layoutStore.getNodeLayoutRef('node-1').value?.position.x).toBe(63)
    expect(layoutStore.vueDragSnapGuides.value).toEqual([])
  })

  it('suppresses alignment snapping while grid snapping is active', () => {
    settingValues['Comfy.Canvas.AlignNodesWhileDragging'] = true

    const { startDrag, handleDrag } = useNodeDrag()

    startDrag(
      new PointerEvent('pointerdown', { clientX: 0, clientY: 0 }),
      'node-1'
    )
    handleDrag(
      new PointerEvent('pointermove', {
        clientX: 193,
        clientY: 0,
        shiftKey: true
      }),
      'node-1'
    )

    expect(layoutStore.getNodeLayoutRef('node-1').value?.position.x).toBe(193)
    expect(layoutStore.vueDragSnapGuides.value).toEqual([])
  })
})
