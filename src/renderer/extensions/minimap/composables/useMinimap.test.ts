import { fromPartial } from '@total-typescript/shoehorn'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'

import type { LGraphEventMap } from '@comfyorg/graph-model/LGraphEventMap'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { registerMinimapDecorationLayer } from '@/platform/canvas/minimapDecorationRegistry'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useThemeStore } from '@/platform/theme/themeStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { MinimapDataSource } from '@/renderer/extensions/minimap/data/MinimapDataSource'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvasElement
} from '@/utils/__tests__/canvasTestUtils'

import { useMinimap } from './useMinimap'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

async function mountMinimap() {
  const node = createMockLGraphNode({
    id: toNodeId('first'),
    pos: [13, 27],
    renderingSize: [100, 50],
    mode: 0,
    bgcolor: '#123456'
  })
  const graph = fromPartial<LGraph>({
    id: 'minimap-root',
    rootGraph: { id: 'minimap-root' },
    isRootGraph: true,
    _nodes: [node],
    _groups: [],
    events: new CustomEventTarget<LGraphEventMap>(),
    onNodeAdded: vi.fn(),
    onNodeRemoved: vi.fn(),
    onConnectionChange: vi.fn()
  })
  const host = fromPartial<LGraphCanvas>({
    graph,
    canvas: createTestCanvasElement({ width: 1000, height: 800 }),
    ds: { scale: 1, offset: [0, 0] },
    dpr: 1,
    setDirty: vi.fn()
  })
  useCanvasStore().canvas = host
  await nextTick()
  useCanvasStore().currentGraph = graph
  const context = createMockCanvasRenderingContext2D()
  const element = createTestCanvasElement({
    width: 250,
    height: 200,
    ctx: context
  })
  const container = document.createElement('div')
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(11, 17, 250, 200)
  )
  const canvasRef = shallowRef<HTMLCanvasElement | null>(element)
  const callbacks = [
    graph.onNodeAdded,
    graph.onNodeRemoved,
    graph.onConnectionChange
  ]
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const minimap = scope.run(() =>
    useMinimap({
      canvasRef,
      containerRef: shallowRef(container)
    })
  )
  assert.exists(minimap)
  await nextTick()
  return { minimap, context, graph, host, node, canvasRef, scope, callbacks }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  useSettingStore().settingValues['Comfy.Appearance.DisableAnimations'] = false
  useSettingStore().settingValues['Comfy.Minimap.NodeColors'] = true
  useSettingStore().settingValues['Comfy.Minimap.ShowLinks'] = true
  useSettingStore().settingValues['Comfy.Minimap.ShowGroups'] = true
  useSettingStore().settingValues['Comfy.Minimap.RenderBypassState'] = true
  useSettingStore().settingValues['Comfy.Minimap.RenderErrorState'] = true
})

describe('minimap painting and interaction', () => {
  it('paints on mount and leaves an unchanged map untouched', async () => {
    const { context } = await mountMinimap()
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 250, 200)
    expect(context.fillRect).toHaveBeenCalled()
    vi.mocked(context.clearRect).mockClear()

    await vi.advanceTimersByTimeAsync(500)

    expect(context.clearRect).not.toHaveBeenCalled()
  })

  it('updates geometry and the viewport for direct node movement', async () => {
    const { context, node, minimap } = await mountMinimap()
    const before = minimap.viewportTransforms.value.box
    vi.mocked(context.clearRect).mockClear()

    node.pos[0] += 1700
    await vi.advanceTimersByTimeAsync(100)

    expect(context.clearRect).toHaveBeenCalled()
    expect(minimap.viewportTransforms.value.box).not.toBe(before)
  })

  it('clears an empty graph after showing nodes', async () => {
    const { graph, context } = await mountMinimap()
    vi.mocked(context.clearRect).mockClear()
    vi.mocked(context.fillRect).mockClear()

    graph._nodes = []
    await vi.advanceTimersByTimeAsync(100)

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 250, 200)
    expect(context.fillRect).not.toHaveBeenCalled()
  })

  it('tolerates a replacement canvas without a rendering context', async () => {
    const { canvasRef } = await mountMinimap()
    const replacement = document.createElement('canvas')
    vi.spyOn(replacement, 'getContext').mockReturnValue(null)

    canvasRef.value = replacement
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)

    expect(replacement.getContext).toHaveBeenCalledWith('2d')
  })

  it('repaints direct color changes without rebuilding bounds', async () => {
    const { node, context } = await mountMinimap()
    const bounds = vi.spyOn(MinimapDataSource.prototype, 'getBounds')
    vi.mocked(context.clearRect).mockClear()

    node.bgcolor = '#abcdef'
    await vi.advanceTimersByTimeAsync(100)

    expect(context.clearRect).toHaveBeenCalled()
    expect(bounds).not.toHaveBeenCalled()
  })

  it('persists options and repaints external settings without rebuilding bounds', async () => {
    const { minimap, context } = await mountMinimap()
    const bounds = vi.spyOn(MinimapDataSource.prototype, 'getBounds')
    vi.mocked(useSettingStore().set).mockResolvedValue(undefined)
    await minimap.updateOption('Comfy.Minimap.NodeColors', false)
    expect(useSettingStore().set).toHaveBeenCalledWith(
      'Comfy.Minimap.NodeColors',
      false
    )
    vi.mocked(context.clearRect).mockClear()

    useSettingStore().settingValues['Comfy.Minimap.NodeColors'] = false
    await nextTick()

    expect(context.clearRect).toHaveBeenCalled()
    expect(bounds).not.toHaveBeenCalled()
  })

  it('repaints a theme change without rebuilding bounds', async () => {
    const { context } = await mountMinimap()
    const bounds = vi.spyOn(MinimapDataSource.prototype, 'getBounds')
    vi.mocked(context.clearRect).mockClear()

    useThemeStore().activePresetId = 'light'
    await nextTick()

    expect(context.clearRect).toHaveBeenCalled()
    expect(bounds).not.toHaveBeenCalled()
  })

  it('paints static decoration replacement and removal without rebuilding bounds', async () => {
    const { minimap, graph, context, scope } = await mountMinimap()
    const bounds = vi.spyOn(MinimapDataSource.prototype, 'getBounds')
    const layer = registerMinimapDecorationLayer('controller-static-test')
    onTestFinished(() => {
      scope.stop()
      layer.dispose()
    })
    layer.replace([
      { target: { ...graphScopeOf(graph), nodeId: toNodeId('first') } }
    ])
    await nextTick()
    expect(minimap.decorationCount.value).toBe(1)
    vi.mocked(context.clearRect).mockClear()

    layer.replace([])
    await nextTick()

    expect(minimap.decorationCount.value).toBe(0)
    expect(context.clearRect).toHaveBeenCalled()
    expect(bounds).not.toHaveBeenCalled()
  })

  it('animates decorations without walking bounds and paints the settled frame', async () => {
    const { graph, context, scope } = await mountMinimap()
    const bounds = vi.spyOn(MinimapDataSource.prototype, 'getBounds')
    const layer = registerMinimapDecorationLayer('controller-animation-test')
    onTestFinished(() => {
      scope.stop()
      layer.dispose()
    })
    layer.replace([
      {
        target: { ...graphScopeOf(graph), nodeId: toNodeId('first') },
        enter: 'pop'
      }
    ])
    await nextTick()
    vi.mocked(context.clearRect).mockClear()

    await vi.advanceTimersByTimeAsync(300)
    expect(context.clearRect).toHaveBeenCalled()
    expect(bounds).not.toHaveBeenCalled()
    vi.mocked(context.clearRect).mockClear()
    await vi.advanceTimersByTimeAsync(300)
    expect(context.clearRect).not.toHaveBeenCalled()
  })

  it.for(['mouse', 'touch', 'pen'])(
    'pans using %s and stops on release',
    async (pointerType) => {
      const { minimap, host } = await mountMinimap()
      minimap.handlePointerDown(
        new PointerEvent('pointerdown', {
          clientX: 150,
          clientY: 100,
          pointerType
        })
      )
      expect(host.setDirty).toHaveBeenCalledWith(true, true)
      minimap.handlePointerUp()
      vi.mocked(host.setDirty).mockClear()

      minimap.handlePointerMove(
        new PointerEvent('pointermove', {
          clientX: 200,
          clientY: 150,
          pointerType
        })
      )

      expect(host.setDirty).not.toHaveBeenCalled()
    }
  )

  it.for([
    { deltaY: -100, scale: 1.1 },
    { deltaY: 100, scale: 0.9 }
  ])('zooms with wheel delta $deltaY', async ({ deltaY, scale }) => {
    const { minimap, host } = await mountMinimap()
    const event = new WheelEvent('wheel', {
      deltaY,
      clientX: 150,
      clientY: 100,
      cancelable: true
    })

    minimap.handleWheel(event)

    expect(event.defaultPrevented).toBe(true)
    expect(host.ds.scale).toBeCloseTo(scale)
    expect(host.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('never replaces extension graph callbacks', async () => {
    const { graph, scope, callbacks } = await mountMinimap()
    expect([
      graph.onNodeAdded,
      graph.onNodeRemoved,
      graph.onConnectionChange
    ]).toEqual(callbacks)
    await vi.advanceTimersByTimeAsync(100)
    scope.stop()
    expect([
      graph.onNodeAdded,
      graph.onNodeRemoved,
      graph.onConnectionChange
    ]).toEqual(callbacks)
  })
})
