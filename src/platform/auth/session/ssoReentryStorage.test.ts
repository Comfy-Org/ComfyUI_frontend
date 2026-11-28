import { describe, expect, it, vi } from 'vitest'

import { safeSessionStorage } from '@/base/storage/safeStorage'
import {
  hasRecentSsoReentry,
  markSsoReentry
} from '@/platform/auth/session/ssoReentryStorage'

const ATTEMPT_KEY = 'Comfy.WebSession.SsoReentryAt'
const ATTEMPT_WINDOW_MS = 5 * 60_000
const NOW = 1_760_000_000_000

describe('ssoReentryStorage', () => {
  it('reports no recent attempt when none was recorded', () => {
    expect(hasRecentSsoReentry(NOW)).toBe(false)
  })

  it.for([
    { name: 'an attempt just now', at: NOW, expected: true },
    {
      name: 'an attempt inside the window',
      at: NOW - (ATTEMPT_WINDOW_MS - 1),
      expected: true
    },
    {
      name: 'an attempt exactly at the window edge',
      at: NOW - ATTEMPT_WINDOW_MS,
      expected: false
    },
    {
      name: 'an attempt past the window',
      at: NOW - (ATTEMPT_WINDOW_MS + 1),
      expected: false
    }
  ])('$name reads $expected', ({ at, expected }) => {
    expect(markSsoReentry(at)).toBe(true)

    expect(hasRecentSsoReentry(NOW)).toBe(expected)
  })

  it.for([['{not json'], ['"2026-10-07"'], ['null'], ['{}']] as const)(
    'reports no recent attempt for the malformed record %s',
    ([raw]) => {
      sessionStorage.setItem(ATTEMPT_KEY, raw)

      expect(hasRecentSsoReentry(NOW)).toBe(false)
    }
  )

  it('reports no recent attempt after the clock moves behind the marker', () => {
    expect(markSsoReentry(NOW + 1)).toBe(true)

    expect(hasRecentSsoReentry(NOW)).toBe(false)
  })

  it('treats an unreadable attempt marker as recent, so it never redirects again', () => {
    expect(markSsoReentry(NOW)).toBe(true)
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    expect(hasRecentSsoReentry(NOW)).toBe(true)
  })

  it('reports false when the attempt marker cannot be stored', () => {
    expect(safeSessionStorage.backend).toBe('sessionStorage')
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    expect(markSsoReentry(NOW)).toBe(false)
  })
})
