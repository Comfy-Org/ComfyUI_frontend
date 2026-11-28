import { describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'

import { addNode, createCanvas } from './__fixtures__/canvasHarness'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

describe('LGraphCanvas node menu Distribute Nodes', () => {
  it.for([
    { pinned: false, disabled: false },
    { pinned: true, disabled: true }
  ])(
    'is disabled $disabled when a selected node pinned is $pinned',
    ({ pinned, disabled }) => {
      const graph = new LGraph()
      const canvas = createCanvas(graph)
      const nodes = [
        addNode(graph, 'A', 0, 0),
        addNode(graph, 'B', 200, 0),
        addNode(graph, 'C', 400, 0)
      ]
      canvas.selectNodes(nodes)
      nodes[1].pin(pinned)

      const distribute = canvas
        .getNodeMenuOptions(nodes[0])
        .find((option) => option?.content === 'Distribute Nodes')

      expect(distribute).toMatchObject({ disabled })
    }
  )
})
