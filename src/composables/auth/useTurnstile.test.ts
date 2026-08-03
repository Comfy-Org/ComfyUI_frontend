import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import {
  isTurnstileEnabled,
  normalizeTurnstileMode,
  useTurnstile,
  useTurnstileGate
} from '@/composables/auth/useTurnstile'
import { getTurnstileSiteKey } from '@/config/turnstile'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { api } from '@/scripts/api'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: { value: {} }
}))
vi.mock('@/scripts/api', () => ({
  api: { getServerFeature: vi.fn() }
}))
vi.mock('@/utils/devFeatureFlagOverride', () => ({
  getDevOverride: vi.fn()
}))
vi.mock('@/config/turnstile', () => ({
  getTurnstileSiteKey: vi.fn()
}))

const mockedDevOverride = vi.mocked(getDevOverride)
const mockedGetServerFeature = vi.mocked(api.getServerFeature)
const mockedSiteKey = vi.mocked(getTurnstileSiteKey)

describe('normalizeTurnstileMode', () => {
  it('passes through known modes', () => {
    expect(normalizeTurnstileMode('off')).toBe('off')
    expect(normalizeTurnstileMode('shadow')).toBe('shadow')
    expect(normalizeTurnstileMode('enforce')).toBe('enforce')
  })

  it('clamps unknown or missing values to off', () => {
    expect(normalizeTurnstileMode('enfroce')).toBe('off')
    expect(normalizeTurnstileMode('')).toBe('off')
    expect(normalizeTurnstileMode(undefined)).toBe('off')
  })
})

describe('isTurnstileEnabled', () => {
  it('renders when the flag is active and a sitekey is configured', () => {
    expect(isTurnstileEnabled('shadow', 'site-key')).toBe(true)
    expect(isTurnstileEnabled('enforce', 'site-key')).toBe(true)
  })

  it('does not render when the flag is off', () => {
    expect(isTurnstileEnabled('off', 'site-key')).toBe(false)
  })

  it('does not render without a sitekey (OSS / local builds)', () => {
    expect(isTurnstileEnabled('shadow', '')).toBe(false)
    expect(isTurnstileEnabled('enforce', '')).toBe(false)
  })
})

describe('useTurnstile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    remoteConfig.value = {}
    mockedDevOverride.mockReturnValue(undefined)
    mockedGetServerFeature.mockReturnValue('off')
    mockedSiteKey.mockReturnValue('site-key')
  })

  describe('mode precedence', () => {
    it('prefers the dev override over remote config and the server feature', () => {
      mockedDevOverride.mockReturnValue('enforce')
      remoteConfig.value = { signup_turnstile: 'shadow' }
      mockedGetServerFeature.mockReturnValue('off')

      expect(useTurnstile().mode.value).toBe('enforce')
    })

    it('uses remote config when there is no dev override', () => {
      remoteConfig.value = { signup_turnstile: 'shadow' }

      expect(useTurnstile().mode.value).toBe('shadow')
    })

    it('falls back to the server feature flag (default off) when nothing else is set', () => {
      mockedGetServerFeature.mockReturnValue('enforce')

      expect(useTurnstile().mode.value).toBe('enforce')
      expect(mockedGetServerFeature).toHaveBeenCalledWith(
        'signup_turnstile',
        'off'
      )
    })

    it('clamps an unknown remote-config value to off', () => {
      remoteConfig.value = {
        signup_turnstile: 'bogus' as unknown as 'shadow'
      }

      expect(useTurnstile().mode.value).toBe('off')
    })

    it('resolves to off when every source is unset', () => {
      expect(useTurnstile().mode.value).toBe('off')
    })
  })

  describe('enabled / enforced', () => {
    it('is enabled but not enforced in shadow with a sitekey', () => {
      remoteConfig.value = { signup_turnstile: 'shadow' }

      const { enabled, enforced } = useTurnstile()
      expect(enabled.value).toBe(true)
      expect(enforced.value).toBe(false)
    })

    it('is enabled and enforced in enforce with a sitekey', () => {
      remoteConfig.value = { signup_turnstile: 'enforce' }

      const { enabled, enforced } = useTurnstile()
      expect(enabled.value).toBe(true)
      expect(enforced.value).toBe(true)
    })

    it('is neither enabled nor enforced without a sitekey, even in enforce', () => {
      remoteConfig.value = { signup_turnstile: 'enforce' }
      mockedSiteKey.mockReturnValue('')

      const { enabled, enforced } = useTurnstile()
      expect(enabled.value).toBe(false)
      expect(enforced.value).toBe(false)
    })

    it('is disabled when the mode is off', () => {
      const { enabled, enforced } = useTurnstile()
      expect(enabled.value).toBe(false)
      expect(enforced.value).toBe(false)
    })
  })
})

describe('useTurnstileGate', () => {
  it('waits while enabled with no token yet', () => {
    const { waiting } = useTurnstileGate(ref(true))
    expect(waiting.value).toBe(true)
  })

  it('never waits while disabled', () => {
    const { waiting } = useTurnstileGate(ref(false))
    expect(waiting.value).toBe(false)
  })

  it('stops waiting once a token arrives', () => {
    const { token, waiting } = useTurnstileGate(ref(true))

    token.value = 'token-abc'

    expect(waiting.value).toBe(false)
  })

  it('stops waiting once the widget reports itself unavailable', () => {
    const { unavailable, waiting } = useTurnstileGate(ref(true))

    unavailable.value = true

    expect(waiting.value).toBe(false)
  })

  it('clears stale token/unavailable state when enabled turns off', async () => {
    const enabled = ref(true)
    const { token, unavailable } = useTurnstileGate(enabled)
    token.value = 'stale-token'
    unavailable.value = true

    enabled.value = false
    await nextTick()

    expect(token.value).toBe('')
    expect(unavailable.value).toBe(false)
  })

  // Regression coverage: the reset used to only run on the enabled->disabled
  // transition, so state written while the widget was briefly disabled could
  // survive into the next enabled widget instance.
  it('clears stale token/unavailable state when enabled turns back on', async () => {
    const enabled = ref(true)
    const { token, unavailable } = useTurnstileGate(enabled)

    enabled.value = false
    await nextTick()
    token.value = 'stale-token'
    unavailable.value = true

    enabled.value = true
    await nextTick()

    expect(token.value).toBe('')
    expect(unavailable.value).toBe(false)
  })
})
