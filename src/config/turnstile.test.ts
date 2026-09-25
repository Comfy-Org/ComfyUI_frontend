import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getTurnstileSiteKey } from '@/config/turnstile'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'
// __USE_PROD_CONFIG__ is false under vitest (see vitest.setup.ts), so the
// build-time fallback resolves to the staging sitekey.
const STAGING_TURNSTILE_SITE_KEY = '0x4AAAAAADnYY4_Q0qxHZ5a7'

vi.mock(import('@/platform/remoteConfig/remoteConfig'))

describe('getTurnstileSiteKey', () => {
  beforeEach(() => {
    remoteConfig.value = {}
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')
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
      remoteConfig.value = { turnstile_sitekey: '0xshould-not-be-used' }

      expect(getTurnstileSiteKey()).toBe('')
    })
  })

  describe('cloud build', () => {
    beforeEach(() => {
      vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    })

    it('returns the sitekey delivered via remote config', () => {
      remoteConfig.value = { turnstile_sitekey: '0x4AAAAAreal' }

      expect(getTurnstileSiteKey()).toBe('0x4AAAAAreal')
    })

    it('falls back to the build-time per-env sitekey during a remote-config gap', () => {
      expect(getTurnstileSiteKey()).toBe(STAGING_TURNSTILE_SITE_KEY)
    })
  })
})
