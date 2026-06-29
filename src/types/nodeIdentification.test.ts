import { describe, expect, it } from 'vitest'

import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import {
  compareExecutionId,
  createNodeExecutionId,
  createNodeLocatorId,
  getAncestorExecutionIds,
  getParentExecutionIds,
  isNodeExecutionId,
  isNodeLocatorId,
  parseNodeExecutionId,
  parseNodeLocatorId,
  tryNormalizeNodeExecutionId
} from '@/types/nodeIdentification'

describe('nodeIdentification', () => {
  describe('NodeLocatorId', () => {
    const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const validNodeId = '123'
    const validNodeLocatorId = createNodeLocatorId(
      validUuid,
      toNodeId(validNodeId)
    )

    describe('isNodeLocatorId', () => {
      it('should return true for valid NodeLocatorId', () => {
        expect(isNodeLocatorId(validNodeLocatorId)).toBe(true)
        expect(isNodeLocatorId(`${validUuid}:456`)).toBe(true)
        expect(isNodeLocatorId(`${validUuid}:node_1`)).toBe(true)
        // Simple node IDs (root graph)
        expect(isNodeLocatorId('123')).toBe(true)
        expect(isNodeLocatorId('node_1')).toBe(true)
        expect(isNodeLocatorId('5')).toBe(true)
      })

      it('should return false for invalid formats', () => {
        expect(isNodeLocatorId('123:456')).toBe(false) // No UUID in first part
        expect(isNodeLocatorId('not-a-uuid:123')).toBe(false)
        expect(isNodeLocatorId('')).toBe(false) // Empty string
        expect(isNodeLocatorId(':123')).toBe(false) // Empty UUID
        expect(isNodeLocatorId(`${validUuid}:`)).toBe(false) // Empty node ID
        expect(isNodeLocatorId(`${validUuid}:123:456`)).toBe(false) // Too many parts
        expect(isNodeLocatorId(`${validUuid}:node:1`)).toBe(false)
        expect(isNodeLocatorId(123)).toBe(false) // Not a string
        expect(isNodeLocatorId(null)).toBe(false)
        expect(isNodeLocatorId(undefined)).toBe(false)
      })

      it('should validate UUID format correctly', () => {
        // Valid UUID formats
        expect(
          isNodeLocatorId('00000000-0000-0000-0000-000000000000:123')
        ).toBe(true)
        expect(
          isNodeLocatorId('A1B2C3D4-E5F6-7890-ABCD-EF1234567890:123')
        ).toBe(true)

        // Invalid UUID formats
        expect(isNodeLocatorId('00000000-0000-0000-0000-00000000000:123')).toBe(
          false
        ) // Too short
        expect(
          isNodeLocatorId('00000000-0000-0000-0000-0000000000000:123')
        ).toBe(false) // Too long
        expect(
          isNodeLocatorId('00000000_0000_0000_0000_000000000000:123')
        ).toBe(false) // Wrong separator
        expect(
          isNodeLocatorId('g0000000-0000-0000-0000-000000000000:123')
        ).toBe(false) // Invalid hex
      })
    })

    describe('parseNodeLocatorId', () => {
      it('should parse valid NodeLocatorId', () => {
        expect(validNodeLocatorId).not.toBeNull()
        if (!validNodeLocatorId) return

        const result = parseNodeLocatorId(validNodeLocatorId)
        expect(result).toEqual({
          subgraphUuid: validUuid,
          localNodeId: '123'
        })
      })

      it('should handle string node IDs', () => {
        const stringNodeId = `${validUuid}:node_1`
        const result = parseNodeLocatorId(stringNodeId)
        expect(result).toEqual({
          subgraphUuid: validUuid,
          localNodeId: 'node_1'
        })
      })

      it('should handle simple node IDs (root graph)', () => {
        const result = parseNodeLocatorId('123')
        expect(result).toEqual({
          subgraphUuid: null,
          localNodeId: '123'
        })

        const stringResult = parseNodeLocatorId('node_1')
        expect(stringResult).toEqual({
          subgraphUuid: null,
          localNodeId: 'node_1'
        })
      })

      it('should return null for invalid formats', () => {
        expect(parseNodeLocatorId('123:456')).toBeNull() // No UUID in first part
        expect(parseNodeLocatorId(`${validUuid}:node:1`)).toBeNull()
        expect(parseNodeLocatorId('')).toBeNull()
      })
    })

    describe('createNodeLocatorId', () => {
      it('should create NodeLocatorId from components', () => {
        const result = createNodeLocatorId(validUuid, toNodeId(123))
        expect(result).toBe(validNodeLocatorId)
        expect(isNodeLocatorId(result)).toBe(true)
      })

      it('should handle string node IDs', () => {
        const result = createNodeLocatorId(validUuid, toNodeId('node_1'))
        expect(result).toBe(`${validUuid}:node_1`)
        expect(isNodeLocatorId(result)).toBe(true)
      })

      it('should return null for node ID segments with separators', () => {
        expect(createNodeLocatorId(validUuid, toNodeId('node:1'))).toBeNull()
        expect(createNodeLocatorId(null, toNodeId('node:1'))).toBeNull()
      })
    })
  })

  describe('NodeExecutionId', () => {
    describe('isNodeExecutionId', () => {
      it('should return true for execution IDs', () => {
        expect(isNodeExecutionId('123:456')).toBe(true)
        expect(isNodeExecutionId('123:456:789')).toBe(true)
        expect(isNodeExecutionId('node_1:node_2')).toBe(true)
        expect(isNodeExecutionId('123')).toBe(true)
        expect(isNodeExecutionId('node_1')).toBe(true)
      })

      it('should return false for malformed execution IDs', () => {
        expect(isNodeExecutionId('')).toBe(false)
        expect(isNodeExecutionId(':123')).toBe(false)
        expect(isNodeExecutionId('123:')).toBe(false)
        expect(isNodeExecutionId('123::456')).toBe(false)
        expect(isNodeExecutionId(123)).toBe(false)
        expect(isNodeExecutionId(null)).toBe(false)
        expect(isNodeExecutionId(undefined)).toBe(false)
      })
    })

    describe('tryNormalizeNodeExecutionId', () => {
      it('should return a branded ID for valid execution IDs', () => {
        expect(tryNormalizeNodeExecutionId(123)).toBe('123')
        expect(tryNormalizeNodeExecutionId('123:456')).toBe('123:456')
      })

      it('should return null for malformed execution IDs', () => {
        expect(tryNormalizeNodeExecutionId('')).toBeNull()
        expect(tryNormalizeNodeExecutionId(':123')).toBeNull()
        expect(tryNormalizeNodeExecutionId('123:')).toBeNull()
        expect(tryNormalizeNodeExecutionId('123::456')).toBeNull()
      })
    })

    describe('parseNodeExecutionId', () => {
      it('should parse execution IDs correctly', () => {
        expect(parseNodeExecutionId('123:456')).toEqual(['123', '456'])
        expect(parseNodeExecutionId('123:456:789')).toEqual([
          '123',
          '456',
          '789'
        ])
        expect(parseNodeExecutionId('node_1:node_2')).toEqual([
          'node_1',
          'node_2'
        ])
        expect(parseNodeExecutionId('123:node_2:456')).toEqual([
          '123',
          'node_2',
          '456'
        ])
        expect(parseNodeExecutionId('123')).toEqual(['123'])
        expect(parseNodeExecutionId('node_1')).toEqual(['node_1'])
      })

      it('should return null for malformed execution IDs', () => {
        expect(parseNodeExecutionId('')).toBeNull()
        expect(parseNodeExecutionId(':123')).toBeNull()
        expect(parseNodeExecutionId('123:')).toBeNull()
        expect(parseNodeExecutionId('123::456')).toBeNull()
      })
    })

    describe('createNodeExecutionId', () => {
      it('should create execution IDs from node arrays', () => {
        expect(createNodeExecutionId([toNodeId(123), toNodeId(456)])).toBe(
          '123:456'
        )
        expect(
          createNodeExecutionId([toNodeId(123), toNodeId(456), toNodeId(789)])
        ).toBe('123:456:789')
        expect(
          createNodeExecutionId([toNodeId('node_1'), toNodeId('node_2')])
        ).toBe('node_1:node_2')
        expect(
          createNodeExecutionId([
            toNodeId(123),
            toNodeId('node_2'),
            toNodeId(456)
          ])
        ).toBe('123:node_2:456')
      })

      it('should handle single node ID', () => {
        const result = createNodeExecutionId([toNodeId(123)])
        expect(result).toBe('123')
        expect(isNodeExecutionId(result)).toBe(true)
      })

      it('should return null for an empty array', () => {
        const emptyNodeIds: NodeId[] = []
        expect(createNodeExecutionId(emptyNodeIds)).toBeNull()
      })

      it('should return null for empty path segments', () => {
        expect(createNodeExecutionId([toNodeId('')])).toBeNull()
        expect(createNodeExecutionId([toNodeId(123), toNodeId('')])).toBeNull()
      })

      it('should return null for path segments with separators', () => {
        expect(
          createNodeExecutionId([toNodeId(123), toNodeId('node:1')])
        ).toBeNull()
      })
    })
  })

  describe('Integration tests', () => {
    it('should round-trip NodeLocatorId correctly', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const localNodeId: NodeId = toNodeId(123)

      const locatorId = createNodeLocatorId(uuid, localNodeId)
      expect(locatorId).not.toBeNull()
      if (!locatorId) return

      const parsed = parseNodeLocatorId(locatorId)
      expect(parsed).toBeTruthy()
      expect(parsed!.subgraphUuid).toBe(uuid)
      expect(parsed!.localNodeId).toBe(localNodeId)
    })

    it('should round-trip NodeExecutionId correctly', () => {
      const nodeIds: NodeId[] = [
        toNodeId(123),
        toNodeId('node_2'),
        toNodeId(456)
      ]

      const executionId = createNodeExecutionId(nodeIds)
      expect(executionId).not.toBeNull()
      if (!executionId) return

      const parsed = parseNodeExecutionId(executionId)
      expect(parsed).toEqual(nodeIds)
    })
  })

  describe('getAncestorExecutionIds', () => {
    it('returns only itself for a root node', () => {
      expect(getAncestorExecutionIds('65')).toEqual(['65'])
    })

    it('returns an empty list for malformed execution IDs', () => {
      expect(getAncestorExecutionIds('65::70')).toEqual([])
    })

    it('returns all ancestors including self for nested IDs', () => {
      expect(getAncestorExecutionIds('65:70')).toEqual(['65', '65:70'])
      expect(getAncestorExecutionIds('65:70:63')).toEqual([
        '65',
        '65:70',
        '65:70:63'
      ])
    })
  })

  describe('getParentExecutionIds', () => {
    it('returns empty for a root node', () => {
      expect(getParentExecutionIds('65')).toEqual([])
    })

    it('returns all ancestors excluding self for nested IDs', () => {
      expect(getParentExecutionIds('65:70')).toEqual(['65'])
      expect(getParentExecutionIds('65:70:63')).toEqual(['65', '65:70'])
    })
  })

  describe('compareExecutionId', () => {
    it('sorts simple numeric IDs in ascending order', () => {
      expect(compareExecutionId('1', '2')).toBeLessThan(0)
      expect(compareExecutionId('2', '1')).toBeGreaterThan(0)
      expect(compareExecutionId('5', '5')).toBe(0)
    })

    it('compares nested IDs left-to-right by segment', () => {
      // "1" < "1:20" < "2" < "10:11:12" as documented
      expect(compareExecutionId('1', '1:20')).toBeLessThan(0)
      expect(compareExecutionId('1:20', '2')).toBeLessThan(0)
      expect(compareExecutionId('2', '10:11:12')).toBeLessThan(0)
    })

    it('treats a shorter ID as having trailing segment 0 when comparing', () => {
      // "5" vs "5:0" → first segments equal, second: 0 vs 0 → equal
      expect(compareExecutionId('5', '5:0')).toBe(0)
      // "5" vs "5:1" → second segment 0 < 1
      expect(compareExecutionId('5', '5:1')).toBeLessThan(0)
    })

    it('handles undefined inputs by treating them as empty string (segment 0)', () => {
      expect(compareExecutionId(undefined, '1')).toBeLessThan(0)
      expect(compareExecutionId('1', undefined)).toBeGreaterThan(0)
      expect(compareExecutionId(undefined, undefined)).toBe(0)
    })

    it('handles empty string inputs', () => {
      expect(compareExecutionId('', '1')).toBeLessThan(0)
      expect(compareExecutionId('1', '')).toBeGreaterThan(0)
      expect(compareExecutionId('', '')).toBe(0)
    })

    it('treats non-numeric segments as 0 via NaN guard', () => {
      // Number('foo') → NaN → treated as 0
      expect(compareExecutionId('foo', '1')).toBeLessThan(0)
      expect(compareExecutionId('foo', '0')).toBe(0)
      expect(compareExecutionId('1:foo', '1:0')).toBe(0)
    })
  })
})
