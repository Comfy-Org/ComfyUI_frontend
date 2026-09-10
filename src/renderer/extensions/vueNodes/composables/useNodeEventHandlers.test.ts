import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'

import {
  addNode,
  createCanvas,
  pointerEvent,
  selectedTitles
} from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'

vi.mock<unknown>(
  import('@/renderer/core/canvas/useCanvasInteractions'),
  () => ({
    useCanvasInteractions: () => ({
      shouldHandleNodePointerEvents: computed(() => true)
    })
  })
)

describe('useNodeEventHandlers', () => {
  async function setup() {
    const graph = new LGraph()
    const first = addNode(graph, 'First', 0, 0)
    const second = addNode(graph, 'Second', 300, 0)
    const canvas = createCanvas(graph)
    useCanvasStore().canvas = canvas
    await nextTick()
    return { canvas, first, second }
  }

  it('right click on an unselected node replaces the selection', async () => {
    const { canvas, first, second } = await setup()
    canvas.select(second)

    useNodeEventHandlers().handleNodeRightClick(
      pointerEvent('pointerdown', 10, 10, { button: 2 }),
      first.id
    )

    expect(selectedTitles(canvas)).toEqual(['First'])
  })

  it('right click on a selected node keeps the multi-selection', async () => {
    const { canvas, first, second } = await setup()
    canvas.selectItems([first, second])

    useNodeEventHandlers().handleNodeRightClick(
      pointerEvent('pointerdown', 10, 10, { button: 2 }),
      first.id
    )

    expect(selectedTitles(canvas)).toEqual(['First', 'Second'])
  })
})
