import { describe, expect, it, vi } from 'vitest'

import {
  isAccountBannedResponseBody,
  notifyAccountBanned,
  onAccountBanned
} from '@/platform/auth/accountBanned'

describe('isAccountBannedResponseBody', () => {
  it('is true when the body carries the ACCOUNT_BANNED code', () => {
    expect(isAccountBannedResponseBody({ code: 'ACCOUNT_BANNED' })).toBe(true)
  })

  it('is false for an ordinary access-denied body', () => {
    expect(isAccountBannedResponseBody({ code: 'ACCESS_DENIED' })).toBe(false)
  })

  it('is false for non-object bodies', () => {
    expect(isAccountBannedResponseBody(null)).toBe(false)
    expect(isAccountBannedResponseBody('ACCOUNT_BANNED')).toBe(false)
    expect(isAccountBannedResponseBody(undefined)).toBe(false)
  })
})

describe('account banned subscription', () => {
  it('invokes subscribed listeners on notify', () => {
    const listener = vi.fn()
    const unsubscribe = onAccountBanned(listener)

    notifyAccountBanned()
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  it('stops invoking a listener after it unsubscribes', () => {
    const listener = vi.fn()
    const unsubscribe = onAccountBanned(listener)

    unsubscribe()
    notifyAccountBanned()

    expect(listener).not.toHaveBeenCalled()
  })
})
