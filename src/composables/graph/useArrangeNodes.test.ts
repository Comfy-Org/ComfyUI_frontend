import { describe, expect, it } from 'vitest'
import { computeArrangement } from '@/composables/graph/useArrangeNodes'
import { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import { toNodeId } from '@/types/nodeId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

const GAP = 12
const TITLE = 30 // LiteGraph.NODE_TITLE_HEIGHT default

describe('computeArrangement', () => {
  it('returns no updates when fewer than 2 nodes are selected', () => {
    expect(computeArrangement([], 'vertical')).toEqual([])
    expect(
      computeArrangement(
        [
          createMockLGraphNode({
            id: toNodeId(1),
            pos: [0, 0],
            size: [100, 50]
          })
        ],
        'grid'
      )
    ).toEqual([])
  })

  describe('vertical', () => {
    it('left-aligns to anchor x and stacks downward sorted by current y', () => {
      const nodes = [
        createMockLGraphNode({
          id: toNodeId('a'),
          pos: [10, 100],
          size: [100, 50]
        }),
        createMockLGraphNode({
          id: toNodeId('b'),
          pos: [200, 0],
          size: [80, 30]
        }),
        createMockLGraphNode({
          id: toNodeId('c'),
          pos: [50, 200],
          size: [120, 40]
        })
      ]
      // Anchor: 'a' has smallest x+y (110). Sort by Y: b(0), a(100), c(200).
      // Visual top of layout = anchor.posY - TITLE = 100 - 30 = 70.
      // Each node's pos.y = visualTop + its titleHeight (30).
      // b: pos.y = 70+30 = 100; visualTop += (30+30)+12 = 142
      // a: pos.y = 142+30 = 172; visualTop += (50+30)+12 = 234
      // c: pos.y = 234+30 = 264
      const result = computeArrangement(nodes, 'vertical')
      expect(result).toEqual([
        { nodeId: 'b', position: { x: 10, y: 100 } },
        { nodeId: 'a', position: { x: 10, y: 172 } },
        { nodeId: 'c', position: { x: 10, y: 264 } }
      ])
    })

    it('omits the title-height contribution for NO_TITLE nodes', () => {
      const nodes = [
        createMockLGraphNode({
          id: toNodeId(1),
          pos: [0, 0],
          size: [100, 100],
          title_mode: TitleMode.NO_TITLE
        }),
        createMockLGraphNode({
          id: toNodeId(2),
          pos: [0, 200],
          size: [100, 100],
          title_mode: TitleMode.NO_TITLE
        })
      ]
      // No titles: visualHeight = size[1] = 100. visualTop = 0. Gap = 12.
      // 1: pos.y = 0; visualTop = 0 + 100 + 12 = 112.
      // 2: pos.y = 112.
      const result = computeArrangement(nodes, 'vertical')
      expect(result).toEqual([
        { nodeId: '1', position: { x: 0, y: 0 } },
        { nodeId: '2', position: { x: 0, y: 100 + GAP } }
      ])
    })

    it('preserves heterogeneous heights when computing gaps', () => {
      const nodes = [
        createMockLGraphNode({
          id: toNodeId(1),
          pos: [0, 0],
          size: [100, 200]
        }),
        createMockLGraphNode({ id: toNodeId(2), pos: [0, 50], size: [100, 50] })
      ]
      // visualTop=-30. 1: pos.y=0; visualTop += (200+30)+12 = 212.
      // 2: pos.y = 212+30 = 242.
      const result = computeArrangement(nodes, 'vertical')
      expect(result).toEqual([
        { nodeId: '1', position: { x: 0, y: 0 } },
        { nodeId: '2', position: { x: 0, y: 200 + TITLE + GAP } }
      ])
    })
  })

  describe('horizontal', () => {
    it('top-aligns to anchor y and lays out rightward sorted by current x', () => {
      const nodes = [
        createMockLGraphNode({
          id: toNodeId('a'),
          pos: [100, 50],
          size: [80, 40]
        }),
        createMockLGraphNode({
          id: toNodeId('b'),
          pos: [0, 200],
          size: [60, 30]
        }),
        createMockLGraphNode({
          id: toNodeId('c'),
          pos: [300, 80],
          size: [50, 50]
        })
      ]
      // Anchor: smallest x+y → a(150), b(200), c(380) → anchor 'a' at (100, 50).
      // Sort by X: b(0), a(100), c(300)
      // Lay out from (100, 50):
      //   b at (100, 50)
      //   a at (100 + 60 + 12, 50) = (172, 50)
      //   c at (172 + 80 + 12, 50) = (264, 50)
      const result = computeArrangement(nodes, 'horizontal')
      expect(result).toEqual([
        { nodeId: 'b', position: { x: 100, y: 50 } },
        { nodeId: 'a', position: { x: 172, y: 50 } },
        { nodeId: 'c', position: { x: 264, y: 50 } }
      ])
    })
  })

  describe('grid', () => {
    it('lays out 4 nodes as 2x2 with column/row sizes from max width/height', () => {
      const nodes = [
        createMockLGraphNode({ id: toNodeId(1), pos: [0, 0], size: [100, 50] }),
        createMockLGraphNode({
          id: toNodeId(2),
          pos: [200, 0],
          size: [80, 60]
        }),
        createMockLGraphNode({
          id: toNodeId(3),
          pos: [0, 100],
          size: [120, 40]
        }),
        createMockLGraphNode({
          id: toNodeId(4),
          pos: [200, 100],
          size: [90, 30]
        })
      ]
      // Anchor: 1 at (0,0). Sort by Y then X: 1, 2, 3, 4. cols=2, rows=2.
      // Col widths: col0=max(100,120)=120; col1=max(80,90)=90.
      // Row visual heights: row0=max(50+30,60+30)=90; row1=max(40+30,30+30)=70.
      // colX=[0, 132]. rowVisualTop=[-30, -30+90+12=72].
      // pos.y = rowVisualTop + 30 (titleHeight).
      const result = computeArrangement(nodes, 'grid')
      expect(result).toEqual([
        { nodeId: '1', position: { x: 0, y: 0 } },
        { nodeId: '2', position: { x: 132, y: 0 } },
        { nodeId: '3', position: { x: 0, y: 102 } },
        { nodeId: '4', position: { x: 132, y: 102 } }
      ])
    })

    it('uses ceil(sqrt(n)) columns for non-square counts', () => {
      // 5 nodes → ceil(sqrt(5))=3 cols, 2 rows. Last cell empty.
      const nodes = Array.from({ length: 5 }, (_, i) =>
        createMockLGraphNode({
          id: toNodeId(i + 1),
          pos: [i * 50, i * 50],
          size: [40, 40]
        })
      )
      const result = computeArrangement(nodes, 'grid')
      expect(result).toHaveLength(5)
      // Sorted by Y then X = original order. Anchor = node 1 at (0,0).
      // colWidths=[40,40,40]. rowVisualHeight = 40+30 = 70 each.
      // colX=[0,52,104]. rowVisualTop=[-30, -30+70+12=52]. pos.y = visualTop+30.
      expect(result[0].position).toEqual({ x: 0, y: 0 })
      expect(result[1].position).toEqual({ x: 52, y: 0 })
      expect(result[2].position).toEqual({ x: 104, y: 0 })
      expect(result[3].position).toEqual({ x: 0, y: 82 })
      expect(result[4].position).toEqual({ x: 52, y: 82 })
    })
  })

  describe('anchor selection', () => {
    it('picks the node with smallest x+y, not min-x or min-y alone', () => {
      const nodes = [
        // min y but large x: x+y = 1000
        createMockLGraphNode({
          id: toNodeId('minY'),
          pos: [1000, 0],
          size: [50, 50]
        }),
        // min x but large y: x+y = 1000
        createMockLGraphNode({
          id: toNodeId('minX'),
          pos: [0, 1000],
          size: [50, 50]
        }),
        // smallest x+y: 600
        createMockLGraphNode({
          id: toNodeId('anchor'),
          pos: [300, 300],
          size: [50, 50]
        })
      ]
      const result = computeArrangement(nodes, 'vertical')
      // All updates left-align to anchor.x = 300. First in sort = minY (y=0).
      expect(result[0]).toEqual({
        nodeId: 'minY',
        position: { x: 300, y: 300 }
      })
      expect(result.every((u) => u.position.x === 300)).toBe(true)
    })
  })
})
