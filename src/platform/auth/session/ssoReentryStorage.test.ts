import { describe, expect, it, vi } from 'vitest'

import {
  hasRecentSsoReentry,
  markSsoReentry
} from '@/platform/auth/session/ssoReentryStorage'

describe('ssoReentryStorage', () => {
  it('reports a recorded attempt as recent inside its window', () => {
    const now = Date.now()
    expect(markSsoReentry(now)).toBe(true)

    expect(hasRecentSsoReentry(now + 1000)).toBe(true)
  })

  it('reports no recent attempt when none was recorded', () => {
    expect(hasRecentSsoReentry()).toBe(false)
  })

  it('treats an attempt marker that cannot be read as recent, so it never redirects again', () => {
    expect(markSsoReentry()).toBe(true)
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    expect(hasRecentSsoReentry()).toBe(true)
  })
})
