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
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import type { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvasElement
} from '@/utils/__tests__/canvasTestUtils'

import { useMinimap } from './useMinimap'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

async function mountMinimap(mounted = true) {
  const node = createMockLGraphNode({
    id: toNodeId('node'),
    pos: [0, 0],
    renderingSize: [100, 50],
    mode: 0
  })
  const graph = fromPartial<LGraph>({
    id: 'root',
    rootGraph: { id: 'root' },
    isRootGraph: true,
    _nodes: [node],
    _groups: [],
    events: new CustomEventTarget<LGraphEventMap>()
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
  const canvasRef = shallowRef<HTMLCanvasElement | null>(
    mounted ? element : null
  )
  const container = document.createElement('div')
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 250, 200)
  )
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const added = vi.spyOn(graph.events, 'addEventListener')
  const removed = vi.spyOn(graph.events, 'removeEventListener')
  const minimap = scope.run(() =>
    useMinimap({ canvasRef, containerRef: shallowRef(container) })
  )
  assert.exists(minimap)
  await nextTick()
  await vi.advanceTimersByTimeAsync(100)
  return {
    graph,
    host,
    node,
    context,
    element,
    canvasRef,
    scope,
    minimap,
    added,
    removed,
    container
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
})

describe('minimap scoped scheduling', () => {
  it('tracks camera motion on viewport frames without repainting the graph', async () => {
    const { host, minimap, context } = await mountMinimap()
    const before = minimap.viewportTransforms.value.box
    vi.mocked(context.clearRect).mockClear()
    host.ds.offset[0] = -125

    await vi.advanceTimersByTimeAsync(32)

    expect(minimap.viewportTransforms.value.box).not.toBe(before)
    expect(context.clearRect).not.toHaveBeenCalled()
  })

  it('does not activate a queued late mount after disposal', async () => {
    const { scope, canvasRef, element, context } = await mountMinimap(false)
    canvasRef.value = element
    scope.stop()

    await nextTick()
    await vi.advanceTimersByTimeAsync(500)

    expect(context.clearRect).not.toHaveBeenCalled()
  })

  it('detects direct mutations on the next 100ms tick, not on viewport frames', async () => {
    const { node, context } = await mountMinimap()
    vi.mocked(context.clearRect).mockClear()
    node.pos[0] += 50

    await vi.advanceTimersByTimeAsync(99)
    expect(context.clearRect).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(context.clearRect).toHaveBeenCalledTimes(1)
  })

  it('starts fully paused in an initially hidden document and refreshes on return', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const { node, host, context, minimap } = await mountMinimap()
    const before = minimap.viewportTransforms.value
    node.pos[0] += 50
    host.ds.offset[0] += 80
    await vi.advanceTimersByTimeAsync(500)
    expect(context.clearRect).not.toHaveBeenCalled()
    expect(minimap.viewportTransforms.value).toBe(before)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()

    expect(context.clearRect).toHaveBeenCalled()
    expect(minimap.viewportTransforms.value).not.toBe(before)
  })

  it('pauses hidden work and resumes polling only after a full interval', async () => {
    const { node, context } = await mountMinimap()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    vi.mocked(context.clearRect).mockClear()
    node.pos[0] += 50
    await vi.advanceTimersByTimeAsync(500)
    expect(context.clearRect).not.toHaveBeenCalled()

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(context.clearRect).toHaveBeenCalled()
    vi.mocked(context.clearRect).mockClear()
    node.pos[0] += 50
    await vi.advanceTimersByTimeAsync(99)
    expect(context.clearRect).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(context.clearRect).toHaveBeenCalledTimes(1)
  })

  it('paints when template refs mount late and when the bitmap canvas is replaced', async () => {
    const { context, canvasRef, element } = await mountMinimap(false)
    await vi.advanceTimersByTimeAsync(300)
    expect(context.clearRect).not.toHaveBeenCalled()
    canvasRef.value = element
    await nextTick()
    expect(context.clearRect).toHaveBeenCalled()

    const replacementContext = createMockCanvasRenderingContext2D()
    canvasRef.value = createTestCanvasElement({
      width: 250,
      height: 200,
      ctx: replacementContext
    })
    await nextTick()

    expect(replacementContext.clearRect).toHaveBeenCalledWith(0, 0, 250, 200)
    expect(replacementContext.fillRect).toHaveBeenCalled()
  })

  it('remeasures a replacement host canvas and refreshes an unchanged graph', async () => {
    const { host, context, minimap } = await mountMinimap()
    const before = minimap.viewportTransforms.value.box
    vi.mocked(context.clearRect).mockClear()

    useCanvasStore().canvas = fromPartial<LGraphCanvas>({
      graph: host.graph,
      canvas: createTestCanvasElement({ width: 1600, height: 900 }),
      ds: host.ds,
      dpr: host.dpr,
      setDirty: vi.fn()
    })
    await nextTick()

    expect(minimap.viewportTransforms.value.box).not.toBe(before)
    expect(context.clearRect).toHaveBeenCalled()
  })

  it('clears and disables interaction on graph null, then paints its restoration', async () => {
    const { graph, host, context, minimap, removed } = await mountMinimap()
    vi.mocked(context.clearRect).mockClear()
    useCanvasStore().currentGraph = null
    await nextTick()
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 250, 200)
    expect(removed).toHaveBeenCalledWith('configured', expect.any(Function))
    minimap.handlePointerDown(
      new PointerEvent('pointerdown', { clientX: 80, clientY: 70 })
    )
    minimap.handleWheel(new WheelEvent('wheel', { deltaY: -100 }))
    expect(host.setDirty).not.toHaveBeenCalled()
    expect(host.ds.scale).toBe(1)

    vi.mocked(context.clearRect).mockClear()
    useCanvasStore().currentGraph = graph
    await nextTick()
    expect(context.clearRect).toHaveBeenCalled()
  })

  it('repaints identical configured content on the next bounded poll', async () => {
    const { graph, context } = await mountMinimap()
    vi.mocked(context.clearRect).mockClear()
    graph.events.dispatch('configured')

    await vi.advanceTimersByTimeAsync(100)

    expect(context.clearRect).toHaveBeenCalled()
  })

  it.for(['stop', 'null-before-stop', 'replacement-before-stop'])(
    'releases captured listeners and queued work on %s',
    async (transition) => {
      const {
        graph,
        node,
        context,
        scope,
        minimap,
        added,
        removed,
        container
      } = await mountMinimap()
      const replacement = fromPartial<LGraph>({
        id: 'replacement',
        rootGraph: { id: 'replacement' },
        isRootGraph: true,
        _nodes: graph._nodes,
        _groups: [],
        events: new CustomEventTarget<LGraphEventMap>()
      })
      const replacementAdded = vi.spyOn(replacement.events, 'addEventListener')
      const nextGraphs: Record<string, LGraph | null> = {
        stop: graph,
        'null-before-stop': null,
        'replacement-before-stop': replacement
      }
      useCanvasStore().currentGraph = nextGraphs[transition]
      scope.stop()
      const configuredListener = added.mock.calls.find(
        ([name]) => name === 'configured'
      )?.[1]
      expect(configuredListener).toBeDefined()
      expect(removed).toHaveBeenCalledWith('configured', configuredListener)
      const before = minimap.viewportTransforms.value
      vi.mocked(context.clearRect).mockClear()
      vi.mocked(container.getBoundingClientRect).mockClear()
      node.pos[0] += 100
      graph.events.dispatch('configured')
      window.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('scroll'))
      document.dispatchEvent(new Event('visibilitychange'))
      await nextTick()
      await vi.advanceTimersByTimeAsync(600)

      expect(replacementAdded).not.toHaveBeenCalledWith(
        'configured',
        expect.any(Function)
      )
      expect(context.clearRect).not.toHaveBeenCalled()
      expect(container.getBoundingClientRect).not.toHaveBeenCalled()
      expect(minimap.viewportTransforms.value).toBe(before)
    }
  )
})
