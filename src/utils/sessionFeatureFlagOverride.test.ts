import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

const mockDistribution = vi.hoisted(() => ({
  isCloud: true,
  isNightly: false
}))
vi.mock('@/platform/distribution/types', () => mockDistribution)

type MockUser = { email: string | null; emailVerified: boolean }

const mockCurrentUser = vi.hoisted(() => ({
  value: null as MockUser | null | undefined
}))
vi.mock('vuefire', () => ({
  useCurrentUser: vi.fn(() => mockCurrentUser)
}))

const COMFY_EMPLOYEE = { email: 'dev@comfy.org', emailVerified: true }
const STORAGE_KEY = 'Comfy.FeatureFlagOverride'

function visit(search: string) {
  window.history.replaceState({}, '', search)
}

describe('getSessionOverride', () => {
  beforeEach(() => {
    mockDistribution.isCloud = true
    mockCurrentUser.value = COMFY_EMPLOYEE
    sessionStorage.clear()
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/')
    vi.restoreAllMocks()
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

  it('warns once per URL no matter how often a flag is read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    visit('/?ff=bogus_flag_name')

    getSessionOverride('onboarding_tour_enabled')
    getSessionOverride('onboarding_tour_enabled')
    getSessionOverride('signup_turnstile')

    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('leaves storage untouched for a session that never asks for an override', () => {
    visit('/?unrelated=1')

    expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  describe('rejected requests', () => {
    it('ignores a flag that has not opted in', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      visit('/?ff=unified_cloud_auth')

      expect(getSessionOverride('unified_cloud_auth')).toBeUndefined()
      expect(warn).toHaveBeenCalledWith(
        '[ff] "unified_cloud_auth" is not registered as an overridable flag'
      )
    })

    it('ignores a value that is not valid for the declared type', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      visit('/?ff=onboarding_tour_enabled:yes')

      expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
      expect(warn).toHaveBeenCalledWith(
        '[ff] Invalid boolean value for "onboarding_tour_enabled":',
        'yes'
      )
    })

    it('ignores a string flag requested without a value', () => {
      visit('/?ff=signup_turnstile')

      expect(getSessionOverride('signup_turnstile')).toBeUndefined()
    })

    it('ignores hand-written sessionStorage entries', () => {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          search: '',
          overrides: {
            unified_cloud_auth: true,
            onboarding_tour_enabled: 'not-a-boolean'
          }
        })
      )
      visit('/')

      expect(getSessionOverride('unified_cloud_auth')).toBeUndefined()
      expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
    })

    it('ignores a corrupt storage payload', () => {
      sessionStorage.setItem(STORAGE_KEY, 'not json')
      visit('/?ff=onboarding_tour_enabled')

      expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)
    })
  })

  describe('employee gate', () => {
    const blockedIdentities: [
      label: string,
      currentUser: MockUser | null | undefined
    ][] = [
      [
        'a lookalike domain',
        { email: 'dev@notcomfy.org', emailVerified: true }
      ],
      [
        'an unverified address',
        { email: 'dev@comfy.org', emailVerified: false }
      ],
      ['a signed-out session', null],
      ['a session where auth has not resolved yet', undefined]
    ]

    it.for(blockedIdentities)(
      'withholds the override for %s',
      ([, currentUser]) => {
        mockCurrentUser.value = currentUser
        visit('/?ff=onboarding_tour_enabled')

        expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
      }
    )

    it('applies the override once auth resolves mid-session', () => {
      mockCurrentUser.value = undefined
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
