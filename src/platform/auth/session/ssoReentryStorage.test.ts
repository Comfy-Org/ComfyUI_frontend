import { describe, expect, it, vi } from 'vitest'

import { fakeWebSessionUser } from '@comfyorg/account-core/testing'

import {
  forgetSsoHint,
  hasRecentSsoReentry,
  markSsoReentry,
  readSsoHint,
  rememberSignedInSession
} from '@/platform/auth/session/ssoReentryStorage'

const HINT_KEY = 'Comfy.WebSession.SsoHint'
const ATTEMPT_KEY = 'Comfy.WebSession.SsoReentryAt'
const ATTEMPT_WINDOW_MS = 5 * 60_000

const NOW = 1_760_000_000_000

const user = (overrides: Parameters<typeof fakeWebSessionUser>[0] = {}) =>
  fakeWebSessionUser({ email: 'ada@acme.com', ...overrides })

/** Refuses one storage call, as an embedded Desktop view or private window does. */
function refuse(
  storage: Storage,
  method: 'getItem' | 'setItem' | 'removeItem'
) {
  vi.spyOn(storage, method).mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })
}

describe(rememberSignedInSession, () => {
  it.for([['saml.workos'], ['oidc.workos']] as const)(
    'keeps a hint for a %s session',
    ([provider]) => {
      rememberSignedInSession(user({ signInProvider: provider }))

      expect(readSsoHint()).toEqual({ email: 'ada@acme.com' })
    }
  )

  it.for([
    ['password'],
    ['google.com'],
    ['github.com'],
    ['custom.workos.example'],
    [undefined]
  ] as const)('clears any earlier hint for a %s session', ([provider]) => {
    localStorage.setItem(HINT_KEY, JSON.stringify({ email: 'old@acme.com' }))

    rememberSignedInSession(user({ signInProvider: provider }))

    expect(readSsoHint()).toBeNull()
  })

  it('stores only the email, never anything that could pass for identity', () => {
    rememberSignedInSession(
      user({ signInProvider: 'saml.workos', name: 'Ada', id: 'secret-id' })
    )

    expect(JSON.parse(localStorage.getItem(HINT_KEY) ?? 'null')).toEqual({
      email: 'ada@acme.com'
    })
  })

  it('survives a storage that refuses to write', () => {
    refuse(localStorage, 'setItem')

    expect(() =>
      rememberSignedInSession(user({ signInProvider: 'saml.workos' }))
    ).not.toThrow()
  })

  it('survives a storage that refuses to clear', () => {
    refuse(localStorage, 'removeItem')

    expect(() =>
      rememberSignedInSession(user({ signInProvider: 'google.com' }))
    ).not.toThrow()
  })
})

describe(readSsoHint, () => {
  it('reads null when nothing is stored', () => {
    expect(readSsoHint()).toBeNull()
  })

  it.for([
    ['a malformed body', '{not json'],
    ['a non-object body', '"ada@acme.com"'],
    ['an object with no email', '{"name":"Ada"}'],
    ['an empty email', '{"email":""}'],
    ['a non-string email', '{"email":42}']
  ] as const)('reads null for %s', ([, raw]) => {
    localStorage.setItem(HINT_KEY, raw)

    expect(readSsoHint()).toBeNull()
  })

  it('reads null when storage refuses', () => {
    refuse(localStorage, 'getItem')

    expect(readSsoHint()).toBeNull()
  })
})

describe(forgetSsoHint, () => {
  it('removes a stored hint', () => {
    localStorage.setItem(HINT_KEY, JSON.stringify({ email: 'ada@acme.com' }))

    forgetSsoHint()

    expect(localStorage.getItem(HINT_KEY)).toBeNull()
  })

  it('survives a storage that refuses', () => {
    refuse(localStorage, 'removeItem')

    expect(() => forgetSsoHint()).not.toThrow()
  })
})

describe(hasRecentSsoReentry, () => {
  it('reads false when no attempt was recorded', () => {
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
    markSsoReentry(at)

    expect(hasRecentSsoReentry(NOW)).toBe(expected)
  })

  it.for([['{not json'], ['"2026-10-07"'], ['null'], ['{}']] as const)(
    'reads false for the malformed record %s, so a redirect is still allowed',
    ([raw]) => {
      sessionStorage.setItem(ATTEMPT_KEY, raw)

      expect(hasRecentSsoReentry(NOW)).toBe(false)
    }
  )

  it('reads false for an attempt in the future, so a clock moved back cannot wedge a tab', () => {
    markSsoReentry(NOW + 1)

    expect(hasRecentSsoReentry(NOW)).toBe(false)
  })

  it('reads true when storage refuses, so a tab that cannot remember never loops', () => {
    refuse(sessionStorage, 'getItem')

    expect(hasRecentSsoReentry(NOW)).toBe(true)
  })
})

describe(markSsoReentry, () => {
  it('records the attempt at the time it was given', () => {
    expect(markSsoReentry(NOW)).toBe(true)

    expect(hasRecentSsoReentry(NOW + ATTEMPT_WINDOW_MS - 1)).toBe(true)
    expect(hasRecentSsoReentry(NOW + ATTEMPT_WINDOW_MS)).toBe(false)
  })

  it('reports false when the attempt could not be recorded', () => {
    refuse(sessionStorage, 'setItem')

    expect(markSsoReentry(NOW)).toBe(false)
  })

  it('overwrites an earlier attempt rather than keeping the oldest', () => {
    markSsoReentry(NOW - ATTEMPT_WINDOW_MS * 2)

    markSsoReentry(NOW)

    expect(hasRecentSsoReentry(NOW)).toBe(true)
  })
})

/**
 * How the two records compose. `sendToSignIn` in src/router.ts drives them
 * together, and webSessionFlagOn.test.ts covers that wiring end to end; these
 * pin the composition itself, which neither function shows on its own.
 */
describe('recording an attempt and reading it back', () => {
  it('marks this window as tried, so a second pass stops redirecting', () => {
    expect(hasRecentSsoReentry(NOW)).toBe(false)

    expect(markSsoReentry(NOW)).toBe(true)

    expect(hasRecentSsoReentry(NOW + 1)).toBe(true)
  })

  it('leaves the hint readable after the tab drops its attempt record', () => {
    rememberSignedInSession(user({ signInProvider: 'saml.workos' }))
    markSsoReentry(NOW)

    sessionStorage.clear()

    expect(readSsoHint()).toEqual({ email: 'ada@acme.com' })
    expect(hasRecentSsoReentry(NOW)).toBe(false)
  })
})
