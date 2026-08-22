import { describe, expect, it } from 'vitest'

import { createdUserId } from '@e2e/fixtures/userIdentity'

describe('created user identity', () => {
  it('returns only the backend-generated user ID', () => {
    expect(createdUserId('backend-user-id')).toBe('backend-user-id')
    for (const value of ['', undefined, null, { username: 'alice' }])
      expect(() => createdUserId(value)).toThrow(/no user ID/)
  })
})
