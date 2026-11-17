import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, useTemplateRef } from 'vue'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

import { useNodeHoverCallbacks } from './useNodeHoverCallbacks'

vi.mock(import('@/scripts/app'))

describe('useNodeHoverCallbacks', () => {
  it('calls the node hover callbacks with node-relative positions, even when a widget stops propagation', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('Comparer')
    node.pos = [100, 200]
    graph.add(node)
    const calls: [string, number[]?][] = []
    node.onMouseEnter = () => calls.push(['enter'])
    node.onMouseMove = (_e, pos) => calls.push(['move', [...pos]])
    node.onMouseLeave = () => calls.push(['leave'])
    const canvasElement = document.createElement('canvas')
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    useCanvasStore().canvas = new LGraphCanvas(canvasElement, graph, {
      skip_render: true,
      skip_events: true
    })
    await nextTick()

    const Host = defineComponent(() => {
      const root = useTemplateRef<HTMLElement>('root')
      useNodeHoverCallbacks(node.id, root)
      return () =>
        h('div', { ref: 'root', 'data-testid': 'node' }, [
          h('canvas', {
            'data-testid': 'widget',
            onPointermove: (e: PointerEvent) => e.stopPropagation()
          })
        ])
    })
    render(Host)
    await nextTick()
    const nodeEl = screen.getByTestId('node')
    const widgetEl = screen.getByTestId('widget')

    nodeEl.dispatchEvent(
      new PointerEvent('pointerenter', { clientX: 130, clientY: 245 })
    )
    widgetEl.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 130,
        clientY: 245,
        bubbles: true
      })
    )
    nodeEl.dispatchEvent(
      new PointerEvent('pointerleave', { clientX: 600, clientY: 245 })
    )

    expect(calls).toEqual([['enter'], ['move', [30, 45]], ['leave']])
  })
})
