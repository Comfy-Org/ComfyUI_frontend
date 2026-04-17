import { describe, expect, it } from 'vitest'

import {
  buildFallbackUsername,
  findUserIdByUsername,
  isDuplicateUserErrorMessage
} from '../browser_tests/fixtures/utils/userSetup'

describe('findUserIdByUsername', () => {
  it('finds a user in the standard id-to-name map', () => {
    expect(
      findUserIdByUsername({ users: { user_1: 'alice', user_2: 'bob' } }, 'bob')
    ).toBe('user_2')
  })

  it('finds a user in tuple-style entries', () => {
    expect(
      findUserIdByUsername(
        {
          users: [
            ['user_1', 'alice'],
            ['user_2', 'bob']
          ]
        },
        'alice'
      )
    ).toBe('user_1')
  })

  it('finds a user in object-style entries', () => {
    expect(
      findUserIdByUsername(
        {
          users: [
            { userId: 'user_1', username: 'alice' },
            { id: 'user_2', name: 'bob' }
          ]
        },
        'bob'
      )
    ).toBe('user_2')
  })

  it('returns null for malformed payloads and unknown users', () => {
    expect(findUserIdByUsername(null, 'alice')).toBeNull()
    expect(
      findUserIdByUsername({ users: 'not-a-collection' }, 'alice')
    ).toBeNull()
    expect(
      findUserIdByUsername({ users: { user_1: 'alice' } }, 'bob')
    ).toBeNull()
  })
})

describe('isDuplicateUserErrorMessage', () => {
  it('matches duplicate-user API errors', () => {
    expect(
      isDuplicateUserErrorMessage(
        'Failed to create user: {"error":"Duplicate username."}'
      )
    ).toBe(true)
    expect(
      isDuplicateUserErrorMessage('User already exists in the server state')
    ).toBe(true)
  })

  it('does not match unrelated failures', () => {
    expect(
      isDuplicateUserErrorMessage(
        'Failed to create user: {"error":"Unauthorized"}'
      )
    ).toBe(false)
  })
})

describe('buildFallbackUsername', () => {
  it('adds a deterministic suffix', () => {
    expect(buildFallbackUsername('playwright-test-0', 1234)).toBe(
      'playwright-test-0-1234'
    )
  })
})
