import { describe, expect, it } from 'vitest'

import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import type { WindowRange } from '../virtualListUtils'
import {
  applyWindow,
  calculateSpacerHeights,
  createInitialWindowRange
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
