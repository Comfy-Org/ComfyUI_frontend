import { describe, expect, it } from 'vitest'

import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import type { WindowRange } from './virtualListUtils'
import {
  applyWindow,
  calculateChildrenListBounds,
  calculateSpacerHeightsVariable,
  calculateTreePositionsAndHeights,
  calculateWindowRangeByHeights,
  createInitialWindowRange,
  mergeWindowRange
} from './virtualListUtils'

describe('virtualListUtils', () => {
  describe('createInitialWindowRange', () => {
    it('creates range starting from 0', () => {
      const range = createInitialWindowRange(100, 60)
      expect(range).toEqual({ start: 0, end: 60 })
    })

    it('caps end at totalChildren when less than windowSize', () => {
      const range = createInitialWindowRange(30, 60)
      expect(range).toEqual({ start: 0, end: 30 })
    })

    it('handles zero children', () => {
      const range = createInitialWindowRange(0, 60)
      expect(range).toEqual({ start: 0, end: 0 })
    })
  })

  describe('applyWindow', () => {
    const createMockNode = (
      key: string,
      children?: RenderedTreeExplorerNode[]
    ): RenderedTreeExplorerNode => ({
      key,
      label: `Node ${key}`,
      leaf: !children,
      children,
      totalLeaves: children ? children.length : 1,
      icon: 'pi pi-file',
      type: children ? 'folder' : 'node'
    })

    it('returns leaf node unchanged', () => {
      const leafNode = createMockNode('leaf')
      const result = applyWindow(leafNode, {}, 60)
      expect(result).toEqual(leafNode)
    })

    it('returns node with empty children unchanged', () => {
      const emptyFolderNode = createMockNode('folder', [])
      const result = applyWindow(emptyFolderNode, {}, 60)
      expect(result).toEqual(emptyFolderNode)
    })

    it('applies default window when no range specified', () => {
      const children = Array.from({ length: 100 }, (_, i) =>
        createMockNode(`child-${i}`)
      )
      const parentNode = createMockNode('parent', children)
      const result = applyWindow(parentNode, {}, 60)
      expect(result.children).toHaveLength(60)
      expect(result.children?.[0].key).toBe('child-0')
      expect(result.children?.[59].key).toBe('child-59')
    })

    it('applies specified window range', () => {
      const children = Array.from({ length: 100 }, (_, i) =>
        createMockNode(`child-${i}`)
      )
      const parentNode = createMockNode('parent', children)
      const windowRanges = { parent: { start: 20, end: 80 } }
      const result = applyWindow(parentNode, windowRanges, 60)
      expect(result.children).toHaveLength(60)
      expect(result.children?.[0].key).toBe('child-20')
      expect(result.children?.[59].key).toBe('child-79')
    })

    it('applies window recursively to nested children', () => {
      const grandchildren = Array.from({ length: 100 }, (_, i) =>
        createMockNode(`grandchild-${i}`)
      )
      const child = createMockNode('child', grandchildren)
      const parentNode = createMockNode('parent', [child])
      const windowRanges = { child: { start: 10, end: 30 } }
      const result = applyWindow(parentNode, windowRanges, 60)
      expect(result.children?.[0].children).toHaveLength(20)
      expect(result.children?.[0].children?.[0].key).toBe('grandchild-10')
    })

    it('handles window larger than children count', () => {
      const children = Array.from({ length: 30 }, (_, i) =>
        createMockNode(`child-${i}`)
      )
      const parentNode = createMockNode('parent', children)
      const result = applyWindow(parentNode, {}, 60)
      expect(result.children).toHaveLength(30)
    })
  })

  describe('mergeWindowRange', () => {
    it('returns calculated when existing is undefined', () => {
      const result = mergeWindowRange(
        undefined,
        { start: 10, end: 20 },
        {
          bufferRows: 2,
          windowSize: 10,
          totalChildren: 100
        }
      )
      expect(result).toEqual({ range: { start: 10, end: 20 }, changed: true })
    })

    it('keeps existing when calculated is within buffer', () => {
      const result = mergeWindowRange(
        { start: 10, end: 30 },
        { start: 11, end: 29 },
        { bufferRows: 5, windowSize: 10, totalChildren: 100 }
      )
      expect(result.changed).toBe(false)
      expect(result.range).toEqual({ start: 10, end: 30 })
    })

    it('expands when calculated exceeds existing', () => {
      const result = mergeWindowRange(
        { start: 10, end: 30 },
        { start: 5, end: 40 },
        { bufferRows: 2, windowSize: 10, totalChildren: 100 }
      )
      expect(result.changed).toBe(true)
      // maxWindowSize defaults to windowSize * 2 = 20, so end is capped at start + 20 = 25
      expect(result.range).toEqual({ start: 5, end: 25 })
    })

    it('respects maxWindowSize when provided', () => {
      const result = mergeWindowRange(
        { start: 10, end: 30 },
        { start: 5, end: 40 },
        {
          bufferRows: 2,
          windowSize: 10,
          totalChildren: 100,
          maxWindowSize: 50
        }
      )
      expect(result.changed).toBe(true)
      expect(result.range).toEqual({ start: 5, end: 40 })
    })

    it('shrinks when calculated is smaller and outside buffer', () => {
      const result = mergeWindowRange(
        { start: 10, end: 30 },
        { start: 15, end: 25 },
        { bufferRows: 2, windowSize: 10, totalChildren: 100 }
      )
      expect(result.changed).toBe(true)
      expect(result.range).toEqual({ start: 15, end: 25 })
    })

    it('caps window size when exceeding maxWindowSize on end update', () => {
      const result = mergeWindowRange(
        { start: 10, end: 30 },
        { start: 10, end: 50 },
        { bufferRows: 2, windowSize: 10, totalChildren: 100 }
      )
      expect(result.changed).toBe(true)
      // maxWindowSize = 20, so start is adjusted: end (30) - 20 = 10, but we keep start at 10
      // Actually, since updateStart is false, we adjust start: end (50) - 20 = 30
      expect(result.range.start).toBe(30)
      expect(result.range.end).toBe(50)
    })
  })

  describe('calculateSpacerHeightsVariable', () => {
    it('calculates spacers using variable item heights', () => {
      const items = [10, 20, 30, 40, 50]
      const range: WindowRange = { start: 1, end: 4 } // visible: 20,30,40
      const result = calculateSpacerHeightsVariable(items, range, (n) => n)
      expect(result).toEqual({ topSpacer: 10, bottomSpacer: 50 })
    })
  })

  describe('calculateWindowRangeByHeights', () => {
    it('returns start window when list is below viewport', () => {
      const items = Array.from({ length: 100 }, (_, i) => i)
      const range = calculateWindowRangeByHeights({
        items,
        listStart: 1000,
        listEnd: 2000,
        scrollTop: 0,
        scrollBottom: 300,
        bufferHeight: 50,
        bufferRows: 2,
        windowSize: 10,
        getItemStart: (n) => n * 10,
        getItemHeight: () => 10
      })
      expect(range).toEqual({ start: 0, end: 10 })
    })

    it('returns end window when list is above viewport', () => {
      const items = Array.from({ length: 100 }, (_, i) => i)
      const range = calculateWindowRangeByHeights({
        items,
        listStart: 0,
        listEnd: 500,
        scrollTop: 2000,
        scrollBottom: 2300,
        bufferHeight: 50,
        bufferRows: 2,
        windowSize: 10,
        getItemStart: (n) => n * 10,
        getItemHeight: () => 10
      })
      expect(range).toEqual({ start: 90, end: 100 })
    })

    it('computes window around viewport with buffer and min size', () => {
      const items = Array.from({ length: 100 }, (_, i) => i)
      const range = calculateWindowRangeByHeights({
        items,
        listStart: 0,
        listEnd: 2000,
        scrollTop: 200,
        scrollBottom: 260,
        bufferHeight: 0,
        bufferRows: 2,
        windowSize: 10,
        getItemStart: (n) => n * 10,
        getItemHeight: () => 10
      })
      expect(range.end - range.start).toBeGreaterThanOrEqual(10)
      expect(range.start).toBeLessThanOrEqual(20)
    })
  })

  describe('calculateTreePositionsAndHeights', () => {
    type TestNode = { key: string; children?: TestNode[] }

    it('calculates positions and heights for flat tree', () => {
      const root: { children?: TestNode[] } = {
        children: [{ key: 'a' }, { key: 'b' }, { key: 'c' }]
      }

      const { positions, heights } = calculateTreePositionsAndHeights({
        root,
        itemHeight: 32,
        getChildren: (node) => node.children,
        isExpanded: () => false
      })

      expect(positions.get('a')).toBe(0)
      expect(positions.get('b')).toBe(32)
      expect(positions.get('c')).toBe(64)

      expect(heights.get('a')).toBe(32)
      expect(heights.get('b')).toBe(32)
      expect(heights.get('c')).toBe(32)
    })

    it('calculates positions and heights for nested tree with expanded nodes', () => {
      const root: { children?: TestNode[] } = {
        children: [
          {
            key: 'parent',
            children: [{ key: 'child1' }, { key: 'child2' }]
          }
        ]
      }

      const { positions, heights } = calculateTreePositionsAndHeights({
        root,
        itemHeight: 32,
        getChildren: (node) => node.children,
        isExpanded: (node) => node.key === 'parent'
      })

      expect(positions.get('parent')).toBe(0)
      expect(positions.get('child1')).toBe(32)
      expect(positions.get('child2')).toBe(64)

      expect(heights.get('parent')).toBe(96) // 32 + 32 + 32
      expect(heights.get('child1')).toBe(32)
      expect(heights.get('child2')).toBe(32)
    })

    it('calculates positions and heights for nested tree with collapsed nodes', () => {
      const root: { children?: TestNode[] } = {
        children: [
          {
            key: 'parent',
            children: [{ key: 'child1' }, { key: 'child2' }]
          }
        ]
      }

      const { positions, heights } = calculateTreePositionsAndHeights({
        root,
        itemHeight: 32,
        getChildren: (node) => node.children,
        isExpanded: () => false
      })

      expect(positions.get('parent')).toBe(0)
      expect(heights.get('parent')).toBe(32) // Only parent height, children not included
    })

    it('handles deeply nested tree', () => {
      const root: { children?: TestNode[] } = {
        children: [
          {
            key: 'level1',
            children: [
              {
                key: 'level2',
                children: [{ key: 'level3' }]
              }
            ]
          }
        ]
      }

      const { positions, heights } = calculateTreePositionsAndHeights({
        root,
        itemHeight: 32,
        getChildren: (node) => node.children,
        isExpanded: () => true
      })

      expect(positions.get('level1')).toBe(0)
      expect(positions.get('level2')).toBe(32)
      expect(positions.get('level3')).toBe(64)

      expect(heights.get('level1')).toBe(96) // 32 + 32 + 32
      expect(heights.get('level2')).toBe(64) // 32 + 32
      expect(heights.get('level3')).toBe(32)
    })

    it('handles empty tree', () => {
      const root: { children?: TestNode[] } = { children: [] }

      const { positions, heights } = calculateTreePositionsAndHeights({
        root,
        itemHeight: 32,
        getChildren: (node) => node.children,
        isExpanded: () => false
      })

      expect(positions.size).toBe(0)
      expect(heights.size).toBe(0)
    })

    it('handles root without children', () => {
      const root: { children?: TestNode[] } = {}

      const { positions, heights } = calculateTreePositionsAndHeights({
        root,
        itemHeight: 32,
        getChildren: (node) => node.children,
        isExpanded: () => false
      })

      expect(positions.size).toBe(0)
      expect(heights.size).toBe(0)
    })

    it('handles mixed expanded and collapsed nodes', () => {
      const root: { children?: TestNode[] } = {
        children: [
          {
            key: 'expanded',
            children: [{ key: 'child1' }, { key: 'child2' }]
          },
          {
            key: 'collapsed',
            children: [{ key: 'child3' }]
          }
        ]
      }

      const { positions, heights } = calculateTreePositionsAndHeights({
        root,
        itemHeight: 32,
        getChildren: (node) => node.children,
        isExpanded: (node) => node.key === 'expanded'
      })

      expect(positions.get('expanded')).toBe(0)
      expect(positions.get('child1')).toBe(32)
      expect(positions.get('child2')).toBe(64)
      expect(positions.get('collapsed')).toBe(96)

      expect(heights.get('expanded')).toBe(96) // 32 + 32 + 32
      expect(heights.get('collapsed')).toBe(32) // Only collapsed node height
    })
  })

  describe('calculateChildrenListBounds', () => {
    type TestNode = { key: string }

    it('calculates bounds for node with children', () => {
      const node: TestNode = { key: 'parent' }
      const children: TestNode[] = [
        { key: 'child1' },
        { key: 'child2' },
        { key: 'child3' }
      ]

      const nodePositions = new Map<string, number>([
        ['parent', 0],
        ['child1', 32],
        ['child2', 64],
        ['child3', 96]
      ])

      const nodeHeights = new Map<string, number>([
        ['parent', 128],
        ['child1', 32],
        ['child2', 32],
        ['child3', 32]
      ])

      const result = calculateChildrenListBounds({
        node,
        children,
        nodePositions,
        nodeHeights,
        itemHeight: 32
      })

      expect(result.listStart).toBe(32) // parent position (0) + itemHeight (32)
      expect(result.listEnd).toBe(128) // child3 position (96) + child3 height (32)
    })

    it('handles empty children array', () => {
      const node: TestNode = { key: 'parent' }
      const children: TestNode[] = []

      const nodePositions = new Map<string, number>([['parent', 100]])
      const nodeHeights = new Map<string, number>([['parent', 32]])

      const result = calculateChildrenListBounds({
        node,
        children,
        nodePositions,
        nodeHeights,
        itemHeight: 32
      })

      expect(result.listStart).toBe(132) // parent position (100) + itemHeight (32)
      expect(result.listEnd).toBe(132) // Same as listStart when no children
    })

    it('uses default values when node position is missing', () => {
      const node: TestNode = { key: 'parent' }
      const children: TestNode[] = [{ key: 'child1' }]

      const nodePositions = new Map<string, number>()
      const nodeHeights = new Map<string, number>([['child1', 32]])

      const result = calculateChildrenListBounds({
        node,
        children,
        nodePositions,
        nodeHeights,
        itemHeight: 32
      })

      expect(result.listStart).toBe(32) // default node position (0) + itemHeight (32)
      expect(result.listEnd).toBe(64) // default child position (32) + child height (32)
    })

    it('uses default values when child position or height is missing', () => {
      const node: TestNode = { key: 'parent' }
      const children: TestNode[] = [{ key: 'child1' }]

      const nodePositions = new Map<string, number>([
        ['parent', 0]
        // child1 position missing
      ])
      const nodeHeights = new Map<string, number>()
      // child1 height missing

      const result = calculateChildrenListBounds({
        node,
        children,
        nodePositions,
        nodeHeights,
        itemHeight: 32
      })

      expect(result.listStart).toBe(32) // parent position (0) + itemHeight (32)
      expect(result.listEnd).toBe(64) // default child position (32) + default height (32)
    })

    it('handles single child', () => {
      const node: TestNode = { key: 'parent' }
      const children: TestNode[] = [{ key: 'child1' }]

      const nodePositions = new Map<string, number>([
        ['parent', 0],
        ['child1', 32]
      ])

      const nodeHeights = new Map<string, number>([
        ['parent', 64],
        ['child1', 32]
      ])

      const result = calculateChildrenListBounds({
        node,
        children,
        nodePositions,
        nodeHeights,
        itemHeight: 32
      })

      expect(result.listStart).toBe(32)
      expect(result.listEnd).toBe(64)
    })

    it('handles children with variable heights', () => {
      const node: TestNode = { key: 'parent' }
      const children: TestNode[] = [
        { key: 'child1' },
        { key: 'child2' },
        { key: 'child3' }
      ]

      const nodePositions = new Map<string, number>([
        ['parent', 0],
        ['child1', 32],
        ['child2', 64],
        ['child3', 96]
      ])

      const nodeHeights = new Map<string, number>([
        ['parent', 160],
        ['child1', 32],
        ['child2', 64], // Larger height
        ['child3', 32]
      ])

      const result = calculateChildrenListBounds({
        node,
        children,
        nodePositions,
        nodeHeights,
        itemHeight: 32
      })

      expect(result.listStart).toBe(32)
      expect(result.listEnd).toBe(128) // child3 position (96) + child3 height (32)
    })
  })
})
