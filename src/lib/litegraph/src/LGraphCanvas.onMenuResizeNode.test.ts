import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it } from 'vitest'

import type {
  ContextMenu,
  IContextMenuOptions,
  IContextMenuValue
} from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvas } from '@/utils/__tests__/canvasTestUtils'

function resizeFromMenu(node: LGraphNode, selected: LGraphNode[]) {
  LGraphCanvas.active_canvas = createMockCanvas({
    selectedItems: new Set(selected)
  })
  LGraphCanvas.onMenuResizeNode(
    fromPartial<IContextMenuValue>({}),
    fromPartial<IContextMenuOptions>({}),
    new MouseEvent('click'),
    fromPartial<ContextMenu>({}),
    node
  )
}

describe('LGraphCanvas.onMenuResizeNode', () => {
  const previousCanvas = LGraphCanvas.active_canvas
  afterEach(() => {
    LGraphCanvas.active_canvas = previousCanvas
  })

  it('fits free nodes to their contents while preserving pinned and fixed sizes', () => {
    const graph = new LGraph()
    const [free, pinned, fixed] = ['free', 'pinned', 'fixed'].map((title) => {
      const node = new LGraphNode(title)
      graph.add(node)
      node.size = [317, 149]
      return node
    })
    pinned.pin(true)
    fixed.resizable = false

    resizeFromMenu(free, [free, pinned, fixed])

    expect([free, pinned, fixed].map((node) => [...node.size])).toEqual([
      [140, 26],
      [317, 149],
      [317, 149]
    ])
  })
})
