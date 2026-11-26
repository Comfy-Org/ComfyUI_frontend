import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import {
  addNode,
  createCanvas,
  pointerEvent
} from './__fixtures__/canvasHarness'
import { LGraph } from './litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

function pressLegacyWidget() {
  const graph = new LGraph()
  const canvas = createCanvas(graph)
  const node = addNode(graph, 'node', 0, 0)
  const mouse = vi.fn(() => false)
  const widget = fromPartial<IBaseWidget>({
    name: 'legacy',
    type: 'custom',
    value: 0,
    mouse
  })
  const down = pointerEvent('pointerdown', 10, 10)
  canvas.pointer.down(down)
  canvas.node_widget = [node, widget]
  canvas.processWidgetClick(down, node, widget)
  mouse.mockClear()
  return { canvas, mouse }
}

describe('legacy widget pointer cleanup', () => {
  it('releases the widget when the pointer is cancelled before release', () => {
    const { canvas, mouse } = pressLegacyWidget()

    canvas.pointer.reset()

    expect(canvas.node_widget).toBeNull()
    expect(mouse).not.toHaveBeenCalled()
  })

  it('passes the release event to the widget on pointerup', () => {
    const { canvas, mouse } = pressLegacyWidget()

    canvas.pointer.up(pointerEvent('pointerup', 10, 10))

    expect(mouse).toHaveBeenCalledOnce()
    expect(canvas.node_widget).toBeNull()
  })
})
