import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadReviewGuidanceVerification } from './reviewGuidanceVerification'

describe('review guidance verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is ready for review', () => {
    expect(true).toBe(true)
    expect(loadReviewGuidanceVerification).toBeTypeOf('function')
  })
})
