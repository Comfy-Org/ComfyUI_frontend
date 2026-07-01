import { describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  isAbortError,
  isNonNullish,
  isResultItemType,
  isSlotObject,
  isSubgraph,
  isSubgraphIoNode
} from '@/utils/typeGuardUtil'

type NodeConstructor = { comfyClass?: string }

function createMockNode(nodeConstructor?: NodeConstructor): LGraphNode {
  return { constructor: nodeConstructor } as Partial<LGraphNode> as LGraphNode
}

describe('typeGuardUtil', () => {
  describe('isAbortError', () => {
    it('matches AbortError DOMExceptions only', () => {
      expect(isAbortError(new DOMException('cancelled', 'AbortError'))).toBe(
        true
      )
      expect(isAbortError(new DOMException('failed', 'NetworkError'))).toBe(
        false
      )
      expect(isAbortError({ name: 'AbortError' })).toBe(false)
    })
  })

  describe('isSubgraph', () => {
    it('matches non-root graphs only', () => {
      const subgraph = {
        isRootGraph: false
      } as Parameters<typeof isSubgraph>[0]
      const rootGraph = {
        isRootGraph: true
      } as Parameters<typeof isSubgraph>[0]

      expect(isSubgraph(subgraph)).toBe(true)
      expect(isSubgraph(rootGraph)).toBe(false)
      expect(isSubgraph(null)).toBe(false)
    })
  })

  describe('isNonNullish', () => {
    it('filters nullish values without dropping falsy data', () => {
      const values = [0, '', null, undefined, false, 'ok']
      expect(values.filter(isNonNullish)).toEqual([0, '', false, 'ok'])
    })
  })

  describe('isSubgraphIoNode', () => {
    it('should identify SubgraphInputNode as IO node', () => {
      const node = createMockNode({ comfyClass: 'SubgraphInputNode' })

      expect(isSubgraphIoNode(node)).toBe(true)
    })

    it('should identify SubgraphOutputNode as IO node', () => {
      const node = createMockNode({ comfyClass: 'SubgraphOutputNode' })

      expect(isSubgraphIoNode(node)).toBe(true)
    })

    it('should not identify regular nodes as IO nodes', () => {
      const node = createMockNode({ comfyClass: 'CLIPTextEncode' })

      expect(isSubgraphIoNode(node)).toBe(false)
    })

    it('should handle nodes without constructor', () => {
      const node = createMockNode(undefined)

      expect(isSubgraphIoNode(node)).toBe(false)
    })

    it('should handle nodes without comfyClass', () => {
      const node = createMockNode({})

      expect(isSubgraphIoNode(node)).toBe(false)
    })
  })

  describe('isSlotObject', () => {
    it('requires the slot shape fields', () => {
      expect(
        isSlotObject({ name: 'image', type: 'IMAGE', boundingRect: [] })
      ).toBe(true)
      expect(isSlotObject(null)).toBe(false)
      expect(isSlotObject('image')).toBe(false)
      expect(isSlotObject({ name: 'image', type: 'IMAGE' })).toBe(false)
    })
  })

  describe('isResultItemType', () => {
    it('recognizes backend result buckets', () => {
      expect(['input', 'output', 'temp'].every(isResultItemType)).toBe(true)
      expect(isResultItemType('cache')).toBe(false)
      expect(isResultItemType(undefined)).toBe(false)
    })
  })
})
