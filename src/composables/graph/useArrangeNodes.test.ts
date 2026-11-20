import { describe, expect, it } from 'vitest'

import { computeArrangement } from '@/composables/graph/useArrangeNodes'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { TitleMode } from '@comfyorg/graph-model/globalEnums'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

const GAP = 12
const TITLE = 30

class UntitledNode extends LGraphNode {
  static title_mode = TitleMode.NO_TITLE
}

function nodeAt(
  id: string | number,
  pos: [number, number],
  size: [number, number],
  node: LGraphNode = new LGraphNode('Node')
) {
  node.id = toNodeId(id)
  node.pos = pos
  node.size = size
  node.updateArea()
  return node
}

const at = (id: string | number, x: number, y: number) => ({
  nodeId: toNodeId(id),
  position: { x, y }
})

describe('computeArrangement', () => {
  it('returns no updates when fewer than 2 nodes are selected', () => {
    expect(computeArrangement([], 'vertical')).toEqual([])
    expect(computeArrangement([nodeAt(1, [0, 0], [100, 50])], 'grid')).toEqual(
      []
    )
  })

  describe('vertical', () => {
    it('left-aligns to the anchor and stacks downward sorted by current y', () => {
      const nodes = [
        nodeAt('a', [10, 100], [100, 50]),
        nodeAt('b', [200, 0], [80, 30]),
        nodeAt('c', [50, 200], [120, 40])
      ]
      expect(computeArrangement(nodes, 'vertical')).toEqual([
        at('b', 10, 100),
        at('a', 10, 100 + 30 + TITLE + GAP),
        at('c', 10, 100 + 30 + 50 + 2 * (TITLE + GAP))
      ])
    })

    it('omits the title band for NO_TITLE nodes', () => {
      const nodes = [
        nodeAt(1, [0, 0], [100, 100], new UntitledNode('Node')),
        nodeAt(2, [0, 200], [100, 100], new UntitledNode('Node'))
      ]
      expect(computeArrangement(nodes, 'vertical')).toEqual([
        at(1, 0, 0),
        at(2, 0, 100 + GAP)
      ])
    })

    it('preserves heterogeneous heights when computing gaps', () => {
      const nodes = [
        nodeAt(1, [0, 0], [100, 200]),
        nodeAt(2, [0, 50], [100, 50])
      ]
      expect(computeArrangement(nodes, 'vertical')).toEqual([
        at(1, 0, 0),
        at(2, 0, 200 + TITLE + GAP)
      ])
    })

    it('spaces nodes by their measured bounds, including onBounding growth', () => {
      const tall = new LGraphNode('Tall')
      tall.onBounding = (bounds) => {
        bounds[3] += 100
      }
      const nodes = [
        nodeAt('tall', [0, 0], [100, 50], tall),
        nodeAt('next', [0, 50], [100, 50])
      ]
      expect(computeArrangement(nodes, 'vertical')).toEqual([
        at('tall', 0, 0),
        at('next', 0, 50 + 100 + TITLE + GAP)
      ])
    })
  })

  describe('horizontal', () => {
    it('top-aligns to the anchor and lays out rightward sorted by current x', () => {
      const nodes = [
        nodeAt('a', [100, 50], [80, 40]),
        nodeAt('b', [0, 200], [60, 30]),
        nodeAt('c', [300, 80], [50, 50])
      ]
      expect(computeArrangement(nodes, 'horizontal')).toEqual([
        at('b', 100, 50),
        at('a', 100 + 60 + GAP, 50),
        at('c', 100 + 60 + 80 + 2 * GAP, 50)
      ])
    })
  })

  describe('grid', () => {
    it('sizes columns by their widest node and rows by their tallest', () => {
      const nodes = [
        nodeAt(1, [0, 0], [100, 50]),
        nodeAt(2, [200, 0], [80, 60]),
        nodeAt(3, [0, 100], [120, 40]),
        nodeAt(4, [200, 100], [90, 30])
      ]
      expect(computeArrangement(nodes, 'grid')).toEqual([
        at(1, 0, 0),
        at(2, 120 + GAP, 0),
        at(3, 0, 60 + TITLE + GAP),
        at(4, 120 + GAP, 60 + TITLE + GAP)
      ])
    })

    it('uses ceil(sqrt(n)) columns for non-square counts', () => {
      const nodes = Array.from({ length: 5 }, (_, i) =>
        nodeAt(i + 1, [i * 50, i * 50], [40, 40])
      )
      expect(
        computeArrangement(nodes, 'grid').map(({ position }) => position)
      ).toEqual([
        { x: 0, y: 0 },
        { x: 52, y: 0 },
        { x: 104, y: 0 },
        { x: 0, y: 40 + TITLE + GAP },
        { x: 52, y: 40 + TITLE + GAP }
      ])
    })
  })

  it('anchors on the node with the smallest x + y, not min x or min y alone', () => {
    const nodes = [
      nodeAt('minY', [1000, 0], [50, 50]),
      nodeAt('minX', [0, 1000], [50, 50]),
      nodeAt('anchor', [300, 300], [50, 50])
    ]
    const result = computeArrangement(nodes, 'vertical')
    expect(result[0]).toEqual(at('minY', 300, 300))
    expect(result.every(({ position }) => position.x === 300)).toBe(true)
  })
})
