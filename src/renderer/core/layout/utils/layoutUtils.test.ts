import { describe, expect, it } from 'vitest'

import { makeLinkSegmentKey } from '@/renderer/core/layout/utils/layoutUtils'
import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'

describe('layoutUtils', () => {
  describe('makeLinkSegmentKey', () => {
    it('creates stable keys for null reroute', () => {
      expect(makeLinkSegmentKey(toLinkId(10), null)).toBe('10:final')
      expect(makeLinkSegmentKey(toLinkId(42), null)).toBe('42:final')
    })

    it('creates stable keys for numeric reroute ids', () => {
      expect(makeLinkSegmentKey(toLinkId(10), toRerouteId(3))).toBe('10:3')
      expect(makeLinkSegmentKey(toLinkId(42), toRerouteId(0))).toBe('42:0')
      expect(makeLinkSegmentKey(toLinkId(42), toRerouteId(7))).toBe('42:7')
    })
  })
})
