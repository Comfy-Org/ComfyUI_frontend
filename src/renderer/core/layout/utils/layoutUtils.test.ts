import { describe, expect, it } from 'vitest'

import { makeLinkSegmentKey } from '@/renderer/core/layout/utils/layoutUtils'
import { toRerouteId } from '@/types/rerouteId'

describe('layoutUtils', () => {
  describe('makeLinkSegmentKey', () => {
    it('creates stable keys for null reroute', () => {
      expect(makeLinkSegmentKey(10, null)).toBe('10:final')
      expect(makeLinkSegmentKey(42, null)).toBe('42:final')
    })

    it('creates stable keys for numeric reroute ids', () => {
      expect(makeLinkSegmentKey(10, toRerouteId(3))).toBe('10:3')
      expect(makeLinkSegmentKey(42, toRerouteId(0))).toBe('42:0')
      expect(makeLinkSegmentKey(42, toRerouteId(7))).toBe('42:7')
    })
  })
})
