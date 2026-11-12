import { describe, expect, it } from 'vitest'
import type { ObjectInfo } from '@e2e/fixtures/customNode/objectInfoValidator'
import { missingExpectedNodes } from '@e2e/fixtures/customNode/objectInfoValidator'

const objectInfo: ObjectInfo = {
  KSampler: { input: { required: { model: {}, seed: {} } } }
}

describe('objectInfoValidator', () => {
  it('missingExpectedNodes returns only the names absent from object_info', () => {
    expect(
      missingExpectedNodes(objectInfo, ['KSampler', 'Missing (rgthree)'])
    ).toEqual(['Missing (rgthree)'])
  })

  it('missingExpectedNodes returns empty when every expected node is registered', () => {
    expect(missingExpectedNodes(objectInfo, ['KSampler'])).toEqual([])
  })
})
