import { describe, expect, it } from 'vitest'

import { homeUseCaseGroups } from './home-use-case-groups'

describe('homeUseCaseGroups', () => {
  it('folds the catalogue use cases into the home groups it holds', () => {
    expect(
      homeUseCaseGroups([
        'generate-images',
        'edit-images',
        'animate-images',
        'edit-videos',
        'text',
        'audio'
      ]).map(({ group, useCases }) => [group, useCases])
    ).toEqual([
      ['image', ['generate-images']],
      ['video', ['animate-images']],
      ['edit', ['edit-images', 'edit-videos']],
      ['audio', ['audio']]
    ])
  })

  it('offers no group for an empty catalogue', () => {
    expect(homeUseCaseGroups([])).toEqual([])
  })
})
