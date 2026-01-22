import { describe, expect, it } from 'vitest'

import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import type { WindowRange } from './virtualListUtils'
import {
  applyWindow,
  calculateSpacerHeightsVariable,
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
})
