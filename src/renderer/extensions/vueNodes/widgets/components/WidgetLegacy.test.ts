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
