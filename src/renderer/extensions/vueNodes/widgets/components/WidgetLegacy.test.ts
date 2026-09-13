import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
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
      computeSize: () => [200, 20],
      draw
    })
    const host = fromAny<LGraphNode, unknown>({
      pos: [0, 0],
      size: [200, 240],
      widgets: [widget]
    })
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
  })

  it('stops an expanded paint extent at the adjacent widget boundary', async () => {
    const draw = vi.fn()
    const widget = fromPartial<IBaseWidget>({
      name: 'compare',
      type: 'custom',
      y: 40,
      computeSize: () => [200, 20],
      draw
    })
    const adjacent = fromPartial<IBaseWidget>({
      name: 'after',
      type: 'custom',
      y: 90
    })
    const host = fromAny<LGraphNode, unknown>({
      pos: [0, 0],
      size: [200, 240],
      widgets: [widget, adjacent]
    })
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

  it('uses the promoted host paint boundary instead of an interior source', async () => {
    const hostDraw = vi.fn()
    const sourceDraw = vi.fn()
    const hostWidget = fromPartial<IBaseWidget>({
      name: 'promoted',
      type: 'custom',
      y: 30,
      computeSize: () => [200, 20],
      draw: hostDraw
    })
    const sourceWidget = fromPartial<IBaseWidget>({
      name: 'promoted',
      type: 'custom',
      y: 5,
      draw: sourceDraw
    })
    const source = fromAny<LGraphNode, unknown>({
      size: [100, 100],
      widgets: [sourceWidget]
    })
    const host = fromAny<LGraphNode, unknown>({
      pos: [0, 0],
      size: [200, 180],
      widgets: [hostWidget],
      promotedSource: source
    })
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({
      graph: { getNodeById: () => host }
    })
    canvasStore.linearMode = true

    render(WidgetLegacy, {
      props: {
        widget: fromPartial<SimplifiedWidget<undefined>>({
          name: 'promoted',
          type: 'custom',
          value: undefined,
          options: {}
        }),
        nodeId: toNodeId(7)
      }
    })
    await nextTick()

    expect(fromAny<{ canvasHeight?: number }, unknown>(host).canvasHeight).toBe(
      150
    )
    expect(
      fromAny<{ canvasHeight?: number }, unknown>(source).canvasHeight
    ).toBeUndefined()
    expect(sourceDraw).not.toHaveBeenCalled()
  })

  it('forwards node-local movement to the rebound host and retains pointer movement', async () => {
    const pointerMove = vi.spyOn(CanvasPointer.prototype, 'move')
    const widget = fromPartial<IBaseWidget>({ name: 'compare', type: 'custom' })
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
    const canvasElement = screen.getByTestId('legacy-widget-canvas')
    const user = userEvent.setup()

    await user.pointer({ target: canvasElement, coords: { clientX: 1 } })
    expect(firstMove).toHaveBeenCalledWith(
      expect.any(PointerEvent),
      [120, 250],
      canvas
    )
    expect(pointerMove).toHaveBeenCalledOnce()

    currentHost = reboundHost
    await user.pointer({ target: canvasElement, coords: { clientX: 2 } })
    expect(reboundMove).toHaveBeenCalledWith(
      expect.any(PointerEvent),
      [100, 230],
      canvas
    )
    expect(pointerMove).toHaveBeenCalledTimes(2)

    currentHost = undefined
    await user.pointer({ target: canvasElement, coords: { clientX: 3 } })
    expect(pointerMove).toHaveBeenCalledTimes(2)
  })
})
