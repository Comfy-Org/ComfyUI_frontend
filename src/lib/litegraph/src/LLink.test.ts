import { describe, expect } from 'vite-plus/test'

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
})
