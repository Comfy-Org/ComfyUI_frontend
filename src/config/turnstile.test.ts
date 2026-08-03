import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getTurnstileSiteKey } from '@/config/turnstile'

const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'
// __USE_PROD_CONFIG__ is false under vitest (see vitest.setup.ts), so the
// build-time fallback resolves to the staging sitekey.
const STAGING_TURNSTILE_SITE_KEY = '0x4AAAAAADnYY4_Q0qxHZ5a7'

// Mutable containers go through vi.hoisted so the hoisted vi.mock factories can
// reference them without a temporal-dead-zone crash (which surfaces under
// coverage instrumentation, not a plain run).
const { mockRemoteConfig } = vi.hoisted(() => ({
  mockRemoteConfig: { value: {} as Record<string, unknown> }
}))
vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: mockRemoteConfig,
  configValueOrDefault: (
    cfg: Record<string, unknown>,
    key: string,
    fallback: unknown
  ) => cfg[key] || fallback
}))

describe('getTurnstileSiteKey', () => {
  beforeEach(() => {
    mockRemoteConfig.value = {}
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  describe('OSS / non-cloud build', () => {
    it('falls back to the always-pass test key in dev', () => {
      vi.stubEnv('DEV', true)

      expect(getTurnstileSiteKey()).toBe(TURNSTILE_TEST_SITE_KEY)
    })

    it('returns empty string outside dev so the widget never renders', () => {
      vi.stubEnv('DEV', false)

      expect(getTurnstileSiteKey()).toBe('')
    })

    it('ignores remote config (the widget is cloud-only)', () => {
      vi.stubEnv('DEV', false)
      mockRemoteConfig.value = { turnstile_sitekey: '0xshould-not-be-used' }

      expect(getTurnstileSiteKey()).toBe('')
    })
  })

  describe('cloud build', () => {
    beforeEach(() => {
      vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    })

    it('returns the sitekey delivered via remote config', () => {
      mockRemoteConfig.value = { turnstile_sitekey: '0x4AAAAAreal' }

      expect(getTurnstileSiteKey()).toBe('0x4AAAAAreal')
    })

    it('falls back to the build-time per-env sitekey during a remote-config gap', () => {
      expect(getTurnstileSiteKey()).toBe(STAGING_TURNSTILE_SITE_KEY)
    })
  })
})
