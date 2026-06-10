import { describe, expect } from 'vitest'

import { asNodeId, LLink } from '@/lib/litegraph/src/litegraph'

import { test } from './__fixtures__/testExtensions'

describe('LLink', () => {
  test('matches previous snapshot', () => {
    const link = new LLink(1, 'float', asNodeId(4), 2, asNodeId(5), 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  test('serializes to the previous snapshot', () => {
    const link = new LLink(1, 'float', asNodeId(4), 2, asNodeId(5), 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })
})
