import { describe, expect, it } from 'vitest'

import { isSubgraphIoNode } from '@/utils/typeGuardUtil'

describe('typeGuardUtil', () => {
  describe('isSubgraphIoNode', () => {
    it('should identify SubgraphInputNode as IO node', () => {
      const node = {
        constructor: { comfyClass: 'SubgraphInputNode' }
      } as any

      expect(isSubgraphIoNode(node)).toBe(true)
    })

    it('should identify SubgraphOutputNode as IO node', () => {
      const node = {
        constructor: { comfyClass: 'SubgraphOutputNode' }
      } as any

      expect(isSubgraphIoNode(node)).toBe(true)
    })

    it('should not identify regular nodes as IO nodes', () => {
      const node = {
        constructor: { comfyClass: 'CLIPTextEncode' }
      } as any

      expect(isSubgraphIoNode(node)).toBe(false)
    })

    it('should handle nodes without constructor', () => {
      const node = {} as any

      expect(isSubgraphIoNode(node)).toBe(false)
    })

    it('should handle nodes without comfyClass', () => {
      const node = {
        constructor: {}
      } as any

      expect(isSubgraphIoNode(node)).toBe(false)
    })
  })
})
