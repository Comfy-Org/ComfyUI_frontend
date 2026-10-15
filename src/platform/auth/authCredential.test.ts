import { describe, expect, it, vi } from 'vitest'

import type { AuthHeader } from '@/types/authTypes'

import { authCredentialOf, notifyAuthCredential } from './authCredential'

describe('authCredentialOf', () => {
  it.for([
    [null, 'none'],
    [{ Authorization: 'Bearer t' }, 'bearer'],
    [{ 'X-API-KEY': 'k' }, 'api-key'],
    [{}, 'none'],
    [{ authorization: 'Bearer t' }, 'none']
  ] as const)('classifies %j as %s', ([header, credential]) => {
    expect(authCredentialOf(header as AuthHeader | null)).toBe(credential)
  })
})

describe('notifyAuthCredential', () => {
  it('delivers the credential kind', () => {
    const callback = vi.fn()

    notifyAuthCredential(callback, 'bearer')

    expect(callback).toHaveBeenCalledExactlyOnceWith('bearer')
  })

  it('does nothing without a callback', () => {
    expect(() => notifyAuthCredential(undefined, 'none')).not.toThrow()
  })

  it('swallows a throwing callback', () => {
    expect(() =>
      notifyAuthCredential(() => {
        throw new Error('boom')
      }, 'none')
    ).not.toThrow()
  })
})
