import { describe, expect, it } from 'vitest'

import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import type { WindowRange } from '../virtualListUtils'
import {
  applyWindow,
  calculateScrollPercentage,
  calculateSpacerHeights,
  createInitialWindowRange,
  shiftWindowBackward,
  shiftWindowForward
} from '../virtualListUtils'

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

  describe('shiftWindowForward', () => {
    it('shifts window forward by buffer size', () => {
      const currentRange: WindowRange = { start: 0, end: 60 }
      const result = shiftWindowForward(currentRange, 100, 20, 60)
      expect(result).toEqual({ start: 20, end: 80 })
    })

    it('returns null when already at end', () => {
      const currentRange: WindowRange = { start: 40, end: 100 }
      const result = shiftWindowForward(currentRange, 100, 20, 60)
      expect(result).toBeNull()
    })

    it('caps end at totalChildren', () => {
      const currentRange: WindowRange = { start: 30, end: 90 }
      const result = shiftWindowForward(currentRange, 100, 20, 60)
      expect(result).toEqual({ start: 40, end: 100 })
    })

    it('adjusts start to maintain window size when near end', () => {
      const currentRange: WindowRange = { start: 20, end: 80 }
      const result = shiftWindowForward(currentRange, 95, 20, 60)
      expect(result).toEqual({ start: 35, end: 95 })
    })
  })

  describe('shiftWindowBackward', () => {
    it('shifts window backward by buffer size', () => {
      const currentRange: WindowRange = { start: 40, end: 100 }
      const result = shiftWindowBackward(currentRange, 100, 20, 60)
      expect(result).toEqual({ start: 20, end: 80 })
    })

    it('returns null when already at start', () => {
      const currentRange: WindowRange = { start: 0, end: 60 }
      const result = shiftWindowBackward(currentRange, 100, 20, 60)
      expect(result).toBeNull()
    })

    it('caps start at 0', () => {
      const currentRange: WindowRange = { start: 10, end: 70 }
      const result = shiftWindowBackward(currentRange, 100, 20, 60)
      expect(result).toEqual({ start: 0, end: 60 })
    })

    it('caps end at totalChildren when window would exceed', () => {
      const currentRange: WindowRange = { start: 20, end: 50 }
      const result = shiftWindowBackward(currentRange, 50, 20, 60)
      expect(result).toEqual({ start: 0, end: 50 })
    })
  })

  describe('calculateSpacerHeights', () => {
    it('calculates correct spacer heights', () => {
      const range: WindowRange = { start: 20, end: 80 }
      const result = calculateSpacerHeights(100, range, 28)
      expect(result).toEqual({
        topSpacer: 20 * 28,
        bottomSpacer: 20 * 28
      })
    })

    it('returns zero spacers when window covers all children', () => {
      const range: WindowRange = { start: 0, end: 50 }
      const result = calculateSpacerHeights(50, range, 28)
      expect(result).toEqual({
        topSpacer: 0,
        bottomSpacer: 0
      })
    })

    it('handles window at start', () => {
      const range: WindowRange = { start: 0, end: 60 }
      const result = calculateSpacerHeights(100, range, 28)
      expect(result).toEqual({
        topSpacer: 0,
        bottomSpacer: 40 * 28
      })
    })

    it('handles window at end', () => {
      const range: WindowRange = { start: 40, end: 100 }
      const result = calculateSpacerHeights(100, range, 28)
      expect(result).toEqual({
        topSpacer: 40 * 28,
        bottomSpacer: 0
      })
    })
  })

  describe('calculateScrollPercentage', () => {
    it('calculates percentage correctly', () => {
      const result = calculateScrollPercentage(500, 2000, 400, 0, 0)
      expect(result).toBeCloseTo(0.45)
    })

    it('adjusts for top spacer height', () => {
      const result = calculateScrollPercentage(600, 2000, 400, 200, 200)
      // realContentHeight = 2000 - 200 - 200 = 1600
      // adjustedScrollTop = max(0, 600 - 200) = 400
      // percentage = (400 + 400) / 1600 = 0.5
      expect(result).toBeCloseTo(0.5)
    })

    it('returns 1 when realContentHeight is 0', () => {
      const result = calculateScrollPercentage(0, 100, 50, 50, 50)
      expect(result).toBe(1)
    })

    it('handles scrollTop less than topSpacerHeight', () => {
      const result = calculateScrollPercentage(100, 2000, 400, 200, 200)
      // adjustedScrollTop = max(0, 100 - 200) = 0
      // realContentHeight = 1600
      // percentage = (0 + 400) / 1600 = 0.25
      expect(result).toBeCloseTo(0.25)
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
})
