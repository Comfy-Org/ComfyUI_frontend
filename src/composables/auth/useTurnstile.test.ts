import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTurnstile } from '@/composables/auth/useTurnstile'
import { getTurnstileSiteKey } from '@/config/turnstile'
import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { api } from '@/scripts/api'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/utils/devFeatureFlagOverride'), () => ({
  getDevOverride: vi.fn()
}))
vi.mock(import('@/config/turnstile'), () => ({
  getTurnstileSiteKey: vi.fn()
}))

const mockedDevOverride = vi.mocked(getDevOverride)
const mockedSiteKey = vi.mocked(getTurnstileSiteKey)

// The resolution rules themselves (normalizeTurnstileMode, isTurnstileEnabled,
// useTurnstileGate) live in @comfyorg/account-core and are tested there; this
// suite covers their binding to this app's config sources.
describe('useTurnstile', () => {
  beforeEach(() => {
    mockedDevOverride.mockReturnValue(undefined)
    vi.mocked(api.getServerFeature).mockReturnValue('off')
    mockedSiteKey.mockReturnValue('site-key')
  })

  describe('mode precedence', () => {
    it('prefers the dev override over remote config and the server feature', () => {
      mockedDevOverride.mockReturnValue('enforce')
      useRemoteConfigStore().acceptConfig({ signup_turnstile: 'shadow' }, false)
      vi.mocked(api.getServerFeature).mockReturnValue('off')

      expect(useTurnstile().mode.value).toBe('enforce')
    })

    it('uses remote config when there is no dev override', () => {
      useRemoteConfigStore().acceptConfig({ signup_turnstile: 'shadow' }, false)

      expect(useTurnstile().mode.value).toBe('shadow')
    })

    it('falls back to the server feature flag (default off) when nothing else is set', () => {
      vi.mocked(api.getServerFeature).mockReturnValue('enforce')

      expect(useTurnstile().mode.value).toBe('enforce')
      expect(api.getServerFeature).toHaveBeenCalledWith(
        'signup_turnstile',
        'off'
      )
    })

    it('clamps an unknown remote-config value to off', () => {
      useRemoteConfigStore().acceptConfig({ signup_turnstile: 'bogus' }, false)

      expect(useTurnstile().mode.value).toBe('off')
    })

    it('resolves to off when every source is unset', () => {
      expect(useTurnstile().mode.value).toBe('off')
    })
  })

  describe('enabled / enforced', () => {
    it('is enabled but not enforced in shadow with a sitekey', () => {
      useRemoteConfigStore().acceptConfig({ signup_turnstile: 'shadow' }, false)

      const { enabled, enforced } = useTurnstile()
      expect(enabled.value).toBe(true)
      expect(enforced.value).toBe(false)
    })

    it('is enabled and enforced in enforce with a sitekey', () => {
      useRemoteConfigStore().acceptConfig(
        { signup_turnstile: 'enforce' },
        false
      )

      const { enabled, enforced } = useTurnstile()
      expect(enabled.value).toBe(true)
      expect(enforced.value).toBe(true)
    })

    it('is neither enabled nor enforced without a sitekey, even in enforce', () => {
      useRemoteConfigStore().acceptConfig(
        { signup_turnstile: 'enforce' },
        false
      )
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
