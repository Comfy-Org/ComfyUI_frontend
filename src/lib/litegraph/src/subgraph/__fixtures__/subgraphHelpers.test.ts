import { afterEach, describe, expect, it } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import {
  cleanupComplexPromotionFixtureNodeType,
  setupComplexPromotionFixture
} from './subgraphHelpers'

const FIXTURE_STRING_CONCAT_TYPE = 'Fixture/StringConcatenate'

describe('setupComplexPromotionFixture', () => {
  afterEach(() => {
    cleanupComplexPromotionFixtureNodeType()
  })

  it('can clean up the globally registered fixture node type', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    setupComplexPromotionFixture()
    expect(
      LiteGraph.registered_node_types[FIXTURE_STRING_CONCAT_TYPE]
    ).toBeDefined()

    cleanupComplexPromotionFixtureNodeType()
    expect(
      LiteGraph.registered_node_types[FIXTURE_STRING_CONCAT_TYPE]
    ).toBeUndefined()
  })
})
