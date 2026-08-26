import { describe, expect, it } from 'vitest'

import { createdUserId, testUsername } from '@e2e/fixtures/userIdentity'

describe('created user identity', () => {
  it('returns only the backend-generated user ID', () => {
    expect(createdUserId('backend-user-id')).toBe('backend-user-id')
    for (const value of ['', '   ', undefined, null, { username: 'alice' }])
      expect(() => createdUserId(value)).toThrow(/no user ID/)
  })
})

describe('test username', () => {
  it('creates compact unique names for concurrent workers', () => {
    const first = testUsername('pw', 0)
    const second = testUsername('pw', 1)

    expect(first).toMatch(/^pw-[0-9a-f]{12}-0$/)
    expect(second).not.toBe(first)
  })
})
