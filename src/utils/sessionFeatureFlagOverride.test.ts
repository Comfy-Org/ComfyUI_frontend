import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

/**
 * Overrides are captured once per page load, so each case re-imports the module
 * behind a fresh URL.
 */
async function visit(search: string) {
  window.history.replaceState({}, '', search)
  vi.resetModules()
  return import('@/utils/sessionFeatureFlagOverride')
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

  it('reads a bare flag as boolean true', async () => {
    const { getSessionOverride } = await visit('/?ff=onboarding_tour_enabled')

    expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)
  })

  it('parses an explicit boolean rather than a truthy string', async () => {
    const { getSessionOverride } = await visit(
      '/?ff=onboarding_tour_enabled:false'
    )

    expect(getSessionOverride('onboarding_tour_enabled')).toBe(false)
  })

  it('carries a string value for multivariate flags', async () => {
    const { getSessionOverride } = await visit('/?ff=signup_turnstile:enforce')

    expect(getSessionOverride('signup_turnstile')).toBe('enforce')
  })

  it('keeps colons inside a string value', async () => {
    const { getSessionOverride } = await visit('/?ff=signup_turnstile:a:b')

    expect(getSessionOverride('signup_turnstile')).toBe('a:b')
  })

  it('applies every flag in a repeated query param', async () => {
    const { getSessionOverride } = await visit(
      '/?ff=workflow_sharing_enabled&ff=signup_turnstile:shadow'
    )

    expect(getSessionOverride('workflow_sharing_enabled')).toBe(true)
    expect(getSessionOverride('signup_turnstile')).toBe('shadow')
  })

  it('returns undefined for a flag nobody requested', async () => {
    const { getSessionOverride } = await visit('/?ff=onboarding_tour_enabled')

    expect(getSessionOverride('workflow_sharing_enabled')).toBeUndefined()
  })

  it('survives navigation away from the ?ff= URL', async () => {
    const first = await visit('/?ff=onboarding_tour_enabled')
    expect(first.getSessionOverride('onboarding_tour_enabled')).toBe(true)

    const { getSessionOverride } = await visit('/some/other/page')
    expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)
  })

  it('clears every override for the session on a nameless ?ff=', async () => {
    const first = await visit('/?ff=onboarding_tour_enabled')
    expect(first.getSessionOverride('onboarding_tour_enabled')).toBe(true)

    const { getSessionOverride } = await visit('/?ff=')
    expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
    expect(sessionStorage.getItem('Comfy.FeatureFlagOverride')).toBeNull()
  })

  describe('rejected requests', () => {
    it('ignores a flag that has not opted in', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { getSessionOverride } = await visit('/?ff=unified_cloud_auth')

      expect(getSessionOverride('unified_cloud_auth')).toBeUndefined()
      expect(warn).toHaveBeenCalledWith(
        '[ff] "unified_cloud_auth" is not registered as an overridable flag'
      )
    })

    it('ignores a value that is not valid for the declared type', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { getSessionOverride } = await visit(
        '/?ff=onboarding_tour_enabled:yes'
      )

      expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
      expect(warn).toHaveBeenCalledWith(
        '[ff] Invalid boolean value for "onboarding_tour_enabled":',
        'yes'
      )
    })

    it('ignores a string flag requested without a value', async () => {
      const { getSessionOverride } = await visit('/?ff=signup_turnstile')

      expect(getSessionOverride('signup_turnstile')).toBeUndefined()
    })

    it('ignores hand-written sessionStorage entries', async () => {
      sessionStorage.setItem(
        'Comfy.FeatureFlagOverride',
        JSON.stringify({
          unified_cloud_auth: true,
          onboarding_tour_enabled: 'not-a-boolean'
        })
      )
      const { getSessionOverride } = await visit('/')

      expect(getSessionOverride('unified_cloud_auth')).toBeUndefined()
      expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
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
      async ([, currentUser]) => {
        mockCurrentUser.value = currentUser
        const { getSessionOverride } = await visit(
          '/?ff=onboarding_tour_enabled'
        )

        expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
      }
    )

    it('applies the override once auth resolves mid-session', async () => {
      mockCurrentUser.value = undefined
      const { getSessionOverride } = await visit('/?ff=onboarding_tour_enabled')
      expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()

      mockCurrentUser.value = COMFY_EMPLOYEE
      expect(getSessionOverride('onboarding_tour_enabled')).toBe(true)
    })

    it('withholds the override outside the cloud distribution', async () => {
      mockDistribution.isCloud = false
      const { getSessionOverride } = await visit('/?ff=onboarding_tour_enabled')

      expect(getSessionOverride('onboarding_tour_enabled')).toBeUndefined()
    })
  })
})
