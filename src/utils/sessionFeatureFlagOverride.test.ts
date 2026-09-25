import { fromPartial } from '@total-typescript/shoehorn'
import type { Auth } from 'firebase/auth'
import { initializeAuth } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

const mockDistribution = vi.hoisted(() => ({
  isCloud: true,
  isNightly: false
}))
vi.mock(import('@/platform/distribution/types'), () => mockDistribution)

type MockUser = { email: string | null; emailVerified: boolean }

const mockCurrentUser = { value: null as MockUser | null }
vi.mock(import('firebase/app'), { spy: true })
vi.mock(import('firebase/auth'))
/** The Auth the identity resolves once for this file; reads the live scenario user. */
const resolvedAuth = fromPartial<Auth>({
  get currentUser() {
    return mockCurrentUser.value
  }
})

const COMFY_EMPLOYEE = { email: 'dev@comfy.org', emailVerified: true }
const STORAGE_KEY = 'Comfy.FeatureFlagOverride'

function visit(search: string) {
  window.history.replaceState({}, '', search)
}

describe('getSessionOverride', () => {
  beforeEach(() => {
    mockDistribution.isCloud = true
    mockCurrentUser.value = COMFY_EMPLOYEE
    vi.mocked(initializeAuth).mockReturnValue(resolvedAuth)
    firebaseIdentity.initialize()
  })

  it('reads a bare flag as boolean true', () => {
    visit('/?ff=onboarding_tour_enabled')

    expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)
  })

  it('parses an explicit boolean rather than a truthy string', () => {
    visit('/?ff=onboarding_tour_enabled:false')

    expect(getSessionOverride('onboarding_tour_enabled')).toBe(false)
  })

  it('carries a string value for multivariate flags', () => {
    visit('/?ff=signup_turnstile:enforce')

    expect(getSessionOverride('signup_turnstile')).toBe('enforce')
  })

  it('keeps colons inside a string value', () => {
    visit('/?ff=signup_turnstile:a:b')

    expect(getSessionOverride('signup_turnstile')).toBe('a:b')
  })

  it('applies every flag in a repeated query param', () => {
    visit('/?ff=workflow_sharing_enabled&ff=signup_turnstile:shadow')

    expect(getSessionOverride('workflow_sharing_enabled')).toBe(true)
    expect(getSessionOverride('signup_turnstile')).toBe('shadow')
  })

  it('returns undefined for a flag nobody requested', () => {
    visit('/?ff=onboarding_tour_enabled')

    expect(getSessionOverride('workflow_sharing_enabled')).toBeUndefined()
  })

  it('survives navigation away from the ?ff= URL', () => {
    visit('/?ff=onboarding_tour_enabled')
    expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)

    visit('/some/other/page')
    expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)
  })

  it('clears every override for the session on a nameless ?ff=', () => {
    visit('/?ff=onboarding_tour_enabled')
    expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)

    visit('/?ff=')
    expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
  })

  it('overrides any flag, with no opt-in registry to join', () => {
    visit('/?ff=unified_cloud_auth&ff=some_flag_invented_tomorrow:42')

    expect(getSessionOverride('unified_cloud_auth')).toBe(true)
    expect(getSessionOverride('some_flag_invented_tomorrow')).toBe(42)
  })

  it('writes storage once per URL no matter how often a flag is read', () => {
    visit('/?ff=onboarding_tour_enabled')
    getSessionOverride('onboarding_tour_enabled')

    const write = vi.spyOn(Storage.prototype, 'setItem')
    for (let i = 0; i < 50; i++) getSessionOverride('onboarding_tour_enabled')

    expect(write).not.toHaveBeenCalled()
  })

  it('leaves storage untouched for a session that never asks for an override', () => {
    visit('/?unrelated=1')

    expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  describe('value parsing', () => {
    it('reads a numeric value as a number', () => {
      visit('/?ff=max_upload_size:209715200')

      expect(getSessionOverride('max_upload_size')).toBe(209715200)
    })

    it('keeps a quoted numeric value a string', () => {
      visit('/?ff=churnkey_app_id:"12345"')

      expect(getSessionOverride('churnkey_app_id')).toBe('12345')
    })

    it('reads a JSON object value', () => {
      visit('/?ff=node_replacements:{"a":"b"}')

      expect(getSessionOverride('node_replacements')).toEqual({ a: 'b' })
    })

    it('reads an empty value as an empty string', () => {
      visit('/?ff=churnkey_app_id:')

      expect(getSessionOverride('churnkey_app_id')).toBe('')
    })

    it('never logs the submitted value, which may carry a pasted secret', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      visit('/?ff=some_flag:sk-live-not-a-real-secret')

      expect(getSessionOverride('some_flag')).toBe('sk-live-not-a-real-secret')
      expect(warn).not.toHaveBeenCalled()
      expect(log).not.toHaveBeenCalled()
    })

    it('discards a hand-written storage payload that is not an object', () => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(['nope']))
      visit('/?ff=onboarding_tour_enabled')

      expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)
    })

    it('ignores a corrupt storage payload', () => {
      sessionStorage.setItem(STORAGE_KEY, 'not json')
      visit('/?ff=onboarding_tour_enabled')

      expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)
    })
  })

  describe('employee gate', () => {
    const blockedIdentities: [label: string, currentUser: MockUser | null][] = [
      [
        'a lookalike domain',
        { email: 'dev@notcomfy.org', emailVerified: true }
      ],
      [
        'an unverified address',
        { email: 'dev@comfy.org', emailVerified: false }
      ],
      ['a signed-out session', null]
    ]

    it.for(blockedIdentities)(
      'withholds the override for %s',
      ([, currentUser]) => {
        mockCurrentUser.value = currentUser
        visit('/?ff=onboarding_tour_enabled')

        expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
      }
    )

    it('withholds a stored override before Auth has resolved and does not initialize Firebase', async () => {
      vi.resetModules()
      const [
        { getSessionOverride: readFresh },
        { getApps, initializeApp },
        { remoteConfigState }
      ] = await Promise.all([
        import('@/utils/sessionFeatureFlagOverride'),
        import('firebase/app'),
        import('@/platform/remoteConfig/remoteConfig')
      ])
      vi.mocked(initializeApp).mockClear()
      vi.mocked(getApps).mockReturnValue([])
      remoteConfigState.value = 'anonymous'
      visit('/?ff=onboarding_tour_enabled')

      expect(readFresh('onboarding_tour_enabled')).toBeUndefined()
      expect(initializeApp).not.toHaveBeenCalled()
    })

    it('applies the override once auth resolves mid-session', () => {
      mockCurrentUser.value = null
      visit('/?ff=onboarding_tour_enabled')
      expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()

      mockCurrentUser.value = COMFY_EMPLOYEE
      expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)
    })

    it('accepts a verified address regardless of case', () => {
      mockCurrentUser.value = { email: 'Dev@Comfy.org', emailVerified: true }
      visit('/?ff=onboarding_tour_enabled')

      expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)
    })

    it('withholds the override outside the cloud distribution', () => {
      mockDistribution.isCloud = false
      visit('/?ff=onboarding_tour_enabled')

      expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })
})
