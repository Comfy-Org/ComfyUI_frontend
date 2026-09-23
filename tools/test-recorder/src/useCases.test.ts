import { describe, expect, it } from 'vitest'

import { USE_CASES, useCaseById } from './useCases'

describe('useCaseById', () => {
  it('resolves each declared use case by its id', () => {
    for (const useCase of USE_CASES) {
      expect(useCaseById(useCase.id)).toBe(useCase)
    }
  })

  it('returns undefined for an unknown id', () => {
    expect(useCaseById('write-a-novel')).toBeUndefined()
  })
})

describe('USE_CASES', () => {
  it('has unique ids, since they become select option values', () => {
    const ids = USE_CASES.map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
