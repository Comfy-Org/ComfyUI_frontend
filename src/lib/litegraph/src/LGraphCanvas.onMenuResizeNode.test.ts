import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  ContextMenu,
  IContextMenuOptions,
  IContextMenuValue
} from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'

function resizeFromMenu(node: LGraphNode, selected: LGraphNode[]) {
  LGraphCanvas.active_canvas = fromPartial<LGraphCanvas>({
    selectedItems: new Set(selected),
    setDirty: vi.fn()
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

  it('leaves pinned and non-resizable nodes in the selection alone', () => {
    const graph = new LGraph()
    const [free, pinned, fixed] = ['free', 'pinned', 'fixed'].map((title) => {
      const node = new LGraphNode(title)
      graph.add(node)
      return node
    })
    pinned.pin(true)
    fixed.resizable = false
    const resized = [free, pinned, fixed].map((node) =>
      vi.spyOn(node, 'setSize')
    )

    resizeFromMenu(free, [free, pinned, fixed])

    expect(resized.map((spy) => spy.mock.calls.length)).toEqual([1, 0, 0])
  })
})
