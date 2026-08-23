import { describe, expect, it } from 'vitest'

import { distributionIds, resolveDistribution } from './distributions'

describe('resolveDistribution', () => {
  it('defaults to cloud', () => {
    expect(resolveDistribution(undefined)?.id).toBe('cloud')
  })

  it('resolves every registered distribution', () => {
    expect(distributionIds().map((id) => resolveDistribution(id)?.id)).toEqual(
      distributionIds()
    )
  })

  it('rejects an unknown distribution', () => {
    expect(resolveDistribution('unknown')).toBeUndefined()
  })
})
