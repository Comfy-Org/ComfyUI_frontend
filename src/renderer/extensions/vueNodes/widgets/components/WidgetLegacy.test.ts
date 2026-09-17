import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetLegacy from './WidgetLegacy.vue'

describe('WidgetLegacy', () => {
  it('preserves the final legacy widget paint extent through the host body', async () => {
    const draw = vi.fn()
    const widget = fromPartial<IBaseWidget>({
      name: 'compare',
      type: 'custom',
      y: 40,
      computedHeight: 24,
      computeSize: () => [200, 20],
      draw
    })
    const host = new LGraphNode('host')
    host.size = [200, 240]
    host.widgets = [widget]
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({
      graph: { getNodeById: () => host }
    })
    canvasStore.linearMode = true

    render(WidgetLegacy, {
      props: {
        widget: fromPartial<SimplifiedWidget<undefined>>({
          name: 'compare',
          type: 'custom',
          value: undefined,
          options: {}
        }),
        nodeId: toNodeId(7)
      }
    })
    await nextTick()

    const canvasElement = screen.getByTestId<HTMLCanvasElement>(
      'legacy-widget-canvas'
    )
    expect(canvasElement.height).toBe(404)
    expect(fromAny<{ canvasHeight?: number }, unknown>(host).canvasHeight).toBe(
      200
    )
    expect(widget.y).toBe(40)

    widget.triggerDraw?.()
    widget.triggerDraw?.()

    expect(canvasElement.height).toBe(404)
    expect(host.size[1]).toBe(240)
    expect(fromAny<{ canvasHeight?: number }, unknown>(host).canvasHeight).toBe(
      200
    )
  })

  it('stops an expanded paint extent at the adjacent widget boundary', async () => {
    const draw = vi.fn()
    const widget = fromPartial<IBaseWidget>({
      name: 'compare',
      type: 'custom',
      y: 40,
      computedHeight: 24,
      computeSize: () => [200, 20],
      draw
    })
    const adjacent = fromPartial<IBaseWidget>({
      name: 'after',
      type: 'custom',
      y: 90,
      computedHeight: 24
    })
    const host = new LGraphNode('host')
    host.size = [200, 240]
    host.widgets = [widget, adjacent]
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({
      graph: { getNodeById: () => host }
    })
    canvasStore.linearMode = true

    render(WidgetLegacy, {
      props: {
        widget: fromPartial<SimplifiedWidget<undefined>>({
          name: 'compare',
          type: 'custom',
          value: undefined,
          options: {}
        }),
        nodeId: toNodeId(7)
      }
    })
    await nextTick()

    expect(
      screen.getByTestId<HTMLCanvasElement>('legacy-widget-canvas').height
    ).toBe(104)
    expect(fromAny<{ canvasHeight?: number }, unknown>(host).canvasHeight).toBe(
      50
    )
    expect(widget.y).toBe(40)
  })

  it('ignores hidden widgets when finding the adjacent paint boundary', async () => {
    const widget = fromPartial<IBaseWidget>({
      name: 'compare',
      type: 'custom',
      y: 40,
      computedHeight: 24,
      computeSize: () => [200, 20],
      draw: vi.fn()
    })
    const hidden = fromPartial<IBaseWidget>({
      name: 'hidden',
      type: 'custom',
      hidden: true,
      y: 200,
      computedHeight: 24
    })
    const adjacent = fromPartial<IBaseWidget>({
      name: 'after',
      type: 'custom',
      y: 64,
      computedHeight: 24
    })
    const host = new LGraphNode('host')
    host.size = [200, 240]
    host.widgets = [widget, hidden, adjacent]
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({
      graph: { getNodeById: () => host }
    })
    canvasStore.linearMode = true

    render(WidgetLegacy, {
      props: {
        widget: fromPartial<SimplifiedWidget<undefined>>({
          name: 'compare',
          type: 'custom',
          value: undefined,
          options: {}
        }),
        nodeId: toNodeId(7)
      }
    })
    await nextTick()

    expect(
      screen.getByTestId<HTMLCanvasElement>('legacy-widget-canvas').height
    ).toBe(52)
    expect(fromAny<{ canvasHeight?: number }, unknown>(host).canvasHeight).toBe(
      24
    )
  })

  it('does not treat a pre-arrange widget y as a paint extent', async () => {
    const widget = fromPartial<IBaseWidget>({
      name: 'compare',
      type: 'custom',
      y: 0,
      computeSize: () => [200, 20],
      draw: vi.fn()
    })
    const adjacent = fromPartial<IBaseWidget>({
      name: 'after',
      type: 'custom',
      y: 0
    })
    const host = new LGraphNode('host')
    host.size = [200, 240]
    host.widgets = [widget, adjacent]
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({
      graph: { getNodeById: () => host }
    })
    canvasStore.linearMode = true

    render(WidgetLegacy, {
      props: {
        widget: fromPartial<SimplifiedWidget<undefined>>({
          name: 'compare',
          type: 'custom',
          value: undefined,
          options: {}
        }),
        nodeId: toNodeId(7)
      }
    })
    await nextTick()

    expect(
      screen.getByTestId<HTMLCanvasElement>('legacy-widget-canvas').height
    ).toBe(44)
    expect(fromAny<{ canvasHeight?: number }, unknown>(host).canvasHeight).toBe(
      20
    )
  })

  it('forwards node-local movement to the rebound host and retains pointer movement', async () => {
    const pointerMove = vi.spyOn(CanvasPointer.prototype, 'move')
    const context = fromPartial<CanvasRenderingContext2D>({ scale: vi.fn() })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      fromPartial<HTMLCanvasElement>({ getContext: () => context }).getContext
    )
    const draw = vi.fn()
    const widget = fromPartial<IBaseWidget>({
      name: 'compare',
      type: 'custom',
      draw
    })
    const firstMove = vi.fn()
    const reboundMove = vi.fn()
    const firstHost = fromAny<LGraphNode, unknown>({
      pos: [20, 30],
      widgets: [widget],
      onMouseMove: firstMove
    })
    const reboundHost = fromAny<LGraphNode, unknown>({
      pos: [40, 50],
      widgets: [widget],
      onMouseMove: reboundMove
    })
    let currentHost: LGraphNode | undefined = firstHost
    const canvas = fromPartial<LGraphCanvas>({
      graph: {
        getNodeById: () => currentHost
      },
      graph_mouse: [0, 0],
      adjustMouseEvent: (event: PointerEvent) => {
        fromAny<{ canvasX: number; canvasY: number }, unknown>(event).canvasX =
          140
        fromAny<{ canvasX: number; canvasY: number }, unknown>(event).canvasY =
          280
      }
    })
    const canvasStore = useCanvasStore()
    canvasStore.canvas = canvas
    canvasStore.linearMode = true
    const simplifiedWidget = fromPartial<SimplifiedWidget<undefined>>({
      name: 'compare',
      type: 'custom',
      value: undefined,
      options: {}
    })
    render(WidgetLegacy, {
      props: { widget: simplifiedWidget, nodeId: toNodeId(7) }
    })
    await nextTick()
    draw.mockClear()
    const canvasElement = screen.getByTestId('legacy-widget-canvas')
    const user = userEvent.setup()

    await user.pointer({ target: canvasElement, coords: { clientX: 1 } })
    expect(firstMove).toHaveBeenCalledWith(
      expect.any(PointerEvent),
      [120, 250],
      canvas
    )
    expect(pointerMove).toHaveBeenCalledOnce()
    expect(draw).toHaveBeenCalledOnce()

    currentHost = reboundHost
    await user.pointer({ target: canvasElement, coords: { clientX: 2 } })
    expect(reboundMove).toHaveBeenCalledWith(
      expect.any(PointerEvent),
      [100, 230],
      canvas
    )
    expect(pointerMove).toHaveBeenCalledTimes(2)
    expect(draw).toHaveBeenCalledTimes(2)

    currentHost = undefined
    await user.pointer({ target: canvasElement, coords: { clientX: 3 } })
    expect(pointerMove).toHaveBeenCalledTimes(2)
    expect(draw).toHaveBeenCalledTimes(2)
  })
})
