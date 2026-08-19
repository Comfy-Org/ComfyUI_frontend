import { describe, expect } from 'vitest'

import { LLink } from '@/lib/litegraph/src/litegraph'
import { toLinkId } from '@/types/linkId'

import { test } from './__fixtures__/testExtensions'

describe('LLink', () => {
  test('matches previous snapshot', () => {
    const link = new LLink(toLinkId(1), 'float', 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  test('serializes to the previous snapshot', () => {
    const link = new LLink(toLinkId(1), 'float', 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })
  test('matches numeric caller ids after endpoint normalization', () => {
    const link = new LLink(toLinkId(1), 'float', 4, 2, 5, 3)

    expect(link.hasOrigin(4, 2)).toBe(true)
    expect(link.hasTarget(5, 3)).toBe(true)
  })
})
