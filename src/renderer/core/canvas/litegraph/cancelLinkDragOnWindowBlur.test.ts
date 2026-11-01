import { describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  addNode,
  createCanvas,
  pointerEvent
} from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { cancelLinkDragOnWindowBlur } from '@/renderer/core/canvas/litegraph/cancelLinkDragOnWindowBlur'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

function startOutputLinkDrag() {
  const graph = new LGraph()
  const canvas = createCanvas(graph)
  onTestFinished(cancelLinkDragOnWindowBlur(canvas))
  onTestFinished(() => {
    canvas.unbindEvents()
    canvas.canvas.remove()
  })
  const node = addNode(graph, 'A', 0, 0)
  node.addOutput('value', 'number')
  node.updateArea()
  canvas.visible_nodes = [node]
  const [x, y] = node.getOutputPos(0)
  canvas.processMouseDown(pointerEvent('pointerdown', x, y))
  return canvas
}

describe('cancelLinkDragOnWindowBlur', () => {
  it('cancels a link drag when the window loses focus', () => {
    const canvas = startOutputLinkDrag()
    expect(canvas.linkConnector.isConnecting).toBe(true)

    window.dispatchEvent(new FocusEvent('blur'))

    expect(canvas.linkConnector.isConnecting).toBe(false)
    expect(canvas.pointer.isDown).toBe(false)
  })
})
