import { describe, expect, it } from 'vitest'

import { parseUseCases } from './use-case-address'

describe('parseUseCases', () => {
  it.for([
    ['', []],
    ['?useCase=edit-images', ['edit-images']],
    [
      '?useCase=edit-images,generate-videos',
      ['edit-images', 'generate-videos']
    ],
    ['?useCase=edit-images,nonsense,edit-images', ['edit-images']],
    ['?useCase=other', ['text', '3d', 'audio']]
  ] as const)('reads %s as %j', ([search, useCases]) => {
    expect(parseUseCases(search)).toEqual(useCases)
  })
})
