import { describe, expect, it } from 'vitest'

import { resolveAuthProvider } from '@/platform/auth/authProvider'

describe('resolveAuthProvider', () => {
  it('recognises the providers the app offers a dedicated sign-in for', () => {
    expect(resolveAuthProvider('google.com')).toBe('google')
    expect(resolveAuthProvider('github.com')).toBe('github')
  })

  it('matches on a substring, since the id varies by platform', () => {
    expect(resolveAuthProvider('oidc.google-workspace')).toBe('google')
  })

  it('returns nothing for providers with no dedicated route, so callers ask', () => {
    expect(resolveAuthProvider('password')).toBeUndefined()
    expect(resolveAuthProvider(undefined)).toBeUndefined()
  })
})
