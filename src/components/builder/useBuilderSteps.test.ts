import { describe, expect, it } from 'vitest'

import { builderStepsForTarget } from './useBuilderSteps'

describe('builderStepsForTarget', () => {
  it('includes the arrange step for the app target', () => {
    expect(builderStepsForTarget('app')).toEqual([
      'builder:inputs',
      'builder:outputs',
      'builder:arrange'
    ])
  })

  it('ends at output selection for the api target', () => {
    expect(builderStepsForTarget('api')).toEqual([
      'builder:inputs',
      'builder:outputs'
    ])
  })
})
