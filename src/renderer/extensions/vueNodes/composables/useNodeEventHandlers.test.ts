import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import {
  addNode,
  createCanvas,
  selectedTitles
} from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'

vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'))

vi.mock(
  import('@/renderer/extensions/vueNodes/composables/useNodeZIndex'),
  () => {
    const zIndex: ReturnType<typeof useNodeZIndex> = {
      bringNodeToFront: vi.fn()
    }
    return { useNodeZIndex: () => zIndex }
  }
)

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
    return { canvas, first, second, handlers }
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
    raises: number
  }>([
    { node: 'an unselected node', arrange: () => {}, raises: 1 },
    {
      node: 'a selected node',
      arrange: (canvas, node) => canvas.select(node),
      raises: 0
    },
    {
      node: 'an unselected pinned node',
      arrange: (_, node) => node.pin(true),
      raises: 0
    }
  ])(
    'right click on $node raises it $raises times',
    async ({ arrange, raises }) => {
      const { canvas, first, handlers } = await setup()
      arrange(canvas, first)

      handlers.handleNodeRightClick(rightClick(), first.id)

      expect(useNodeZIndex().bringNodeToFront).toHaveBeenCalledTimes(raises)
    }
  )

  it('right click on a selected node keeps the multi-selection', async () => {
    const { canvas, first, second, handlers } = await setup()
    canvas.selectItems([first, second])

    handlers.handleNodeRightClick(rightClick(), first.id)

    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])
  })
})
