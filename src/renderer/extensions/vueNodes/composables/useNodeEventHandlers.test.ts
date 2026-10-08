import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import {
  addNode,
  createCanvas,
  selectedTitles
} from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'

vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'))

describe('useNodeEventHandlers', () => {
  async function setup() {
    const graph = new LGraph()
    const first = addNode(graph, 'First', 0, 0)
    const second = addNode(graph, 'Second', 300, 0)
    const canvas = createCanvas(graph)
    useCanvasStore().canvas = canvas
    await nextTick()
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const handlers = scope.run(useNodeEventHandlers)
    if (!handlers) throw new Error('handlers require an active scope')
    return { graph, canvas, first, second, handlers }
  }

  function zIndexOf(graph: LGraph, node: LGraphNode) {
    const layout = layoutStore.getNodeLayout(graph.rootGraph.id, node.id)
    assert(layout)
    return layout.zIndex
  }

  function rightClick() {
    return new MouseEvent('contextmenu', { button: 2, cancelable: true })
  }

  it('right click on an unselected node replaces the selection', async () => {
    const { canvas, first, second, handlers } = await setup()
    canvas.select(second)

    handlers.handleNodeRightClick(rightClick(), first.id)

    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it.for<{
    node: string
    arrange: (canvas: LGraphCanvas, node: LGraphNode) => void
    raised: boolean
  }>([
    { node: 'an unselected node', arrange: () => {}, raised: true },
    {
      node: 'a selected node',
      arrange: (canvas, node) => canvas.select(node),
      raised: false
    },
    {
      node: 'an unselected pinned node',
      arrange: (_, node) => node.pin(true),
      raised: false
    }
  ])(
    'right click on $node puts it above the other node: $raised',
    async ({ arrange, raised }) => {
      const { graph, canvas, first, second, handlers } = await setup()
      arrange(canvas, first)
      expect(zIndexOf(graph, first)).toBeLessThan(zIndexOf(graph, second))

      handlers.handleNodeRightClick(rightClick(), first.id)

      expect(zIndexOf(graph, first) > zIndexOf(graph, second)).toBe(raised)
    }
  )

  it('right click on a selected node keeps the multi-selection', async () => {
    const { canvas, first, second, handlers } = await setup()
    canvas.selectItems([first, second])

    handlers.handleNodeRightClick(rightClick(), first.id)

    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])
  })
})
