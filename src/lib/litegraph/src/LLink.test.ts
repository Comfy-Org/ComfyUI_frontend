import { describe, expect } from 'vitest'

import { LLink } from '@/lib/litegraph/src/litegraph'

import { test } from './__fixtures__/testExtensions'

describe('LLink', () => {
  test('matches previous snapshot', () => {
    const link = new LLink(1, 'float', 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  test('serializes to the previous snapshot', () => {
    const link = new LLink(1, 'float', 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  describe('getReroutes', () => {
    test('returns the same empty array instance for links without reroutes', () => {
      const network = { reroutes: new Map() }
      const link1 = new LLink(1, 'float', 4, 2, 5, 3)
      const link2 = new LLink(2, 'float', 4, 2, 5, 3)

      const result1 = LLink.getReroutes(network, link1)
      const result2 = LLink.getReroutes(network, link2)

      expect(result1).toHaveLength(0)
      expect(result1).toBe(result2)
    })
  })
})
