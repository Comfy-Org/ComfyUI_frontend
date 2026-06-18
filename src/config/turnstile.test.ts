import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getTurnstileSiteKey } from '@/config/turnstile'

const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

// Mock remote config with a mutable container + the real merge semantics
// (`configValue || defaultValue`). The container goes through vi.hoisted so the
// hoisted vi.mock factory can reference it without a temporal-dead-zone crash
// (which surfaces under coverage instrumentation, not a plain run).
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
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the sitekey delivered via cloud remote config', () => {
    vi.stubEnv('DEV', false)
    mockRemoteConfig.value = { turnstile_sitekey: '0x4AAAAAreal' }

    expect(getTurnstileSiteKey()).toBe('0x4AAAAAreal')
  })

  it('prefers the remote-config sitekey over the dev test key in dev', () => {
    vi.stubEnv('DEV', true)
    mockRemoteConfig.value = { turnstile_sitekey: '0x4AAAAAreal' }

    expect(getTurnstileSiteKey()).toBe('0x4AAAAAreal')
  })

  it('falls back to the always-pass test key in dev when unconfigured', () => {
    vi.stubEnv('DEV', true)

    expect(getTurnstileSiteKey()).toBe(TURNSTILE_TEST_SITE_KEY)
  })

  it('returns empty string in prod when unconfigured (OSS / non-cloud build)', () => {
    vi.stubEnv('DEV', false)

    expect(getTurnstileSiteKey()).toBe('')
  })
})
