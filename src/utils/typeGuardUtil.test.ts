import { CanceledError } from 'axios'
import { describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isAbortError, isSubgraphIoNode } from '@/utils/typeGuardUtil'

type NodeConstructor = { comfyClass?: string }

function createMockNode(nodeConstructor?: NodeConstructor): LGraphNode {
  return { constructor: nodeConstructor } as Partial<LGraphNode> as LGraphNode
}

describe('typeGuardUtil', () => {
  describe('isAbortError', () => {
    it('should identify a native AbortError', () => {
      expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true)
    })

    it('should identify an axios CanceledError', () => {
      expect(isAbortError(new CanceledError())).toBe(true)
    })

    it('should reject other errors', () => {
      expect(isAbortError(new Error('boom'))).toBe(false)
      expect(isAbortError(new DOMException('nope', 'NotFoundError'))).toBe(
        false
      )
      expect(isAbortError(null)).toBe(false)
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
})
