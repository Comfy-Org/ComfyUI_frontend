import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

const mockDistribution = vi.hoisted(() => ({
  isCloud: true,
  isNightly: false
}))
vi.mock('@/platform/distribution/types', () => mockDistribution)

const mockCurrentUser = vi.hoisted(() => ({
  value: null as { email: string | null; emailVerified: boolean } | null
}))
vi.mock('vuefire', () => ({
  useCurrentUser: vi.fn(() => mockCurrentUser)
}))

/**
 * Every call here happens at plain module scope — no component, no `setup()`,
 * no active Vue instance — which is how `api.getServerFeature` is reached from
 * stores and utilities. Identity is stubbed at the `vuefire` boundary, so what
 * these cases pin is the precedence and gating logic, not VueFire itself.
 *
 * That VueFire resolves the default Firebase app outside a component is a
 * property of the real SDK and needs a real initialised app, so it is verified
 * against a live Firebase app in the browser rather than here.
 */
describe('api.getServerFeature session override outside component setup', () => {
  beforeEach(() => {
    mockDistribution.isCloud = true
    mockCurrentUser.value = { email: 'dev@comfy.org', emailVerified: true }
    api.serverFeatureFlags.value = {}
  })

  afterEach(() => {
    api.serverFeatureFlags.value = {}
  })

  it('applies a numeric override to a flag that never routes through resolveFlag', () => {
    api.serverFeatureFlags.value = { max_upload_size: 100 }
    window.history.replaceState({}, '', '/?ff=max_upload_size:209715200')

    expect(api.getServerFeature('max_upload_size')).toBe(209715200)
  })

  it('does not throw when no Vue instance is active', () => {
    window.history.replaceState({}, '', '/?ff=some_flag:enforce')

    expect(() => api.getServerFeature('some_flag')).not.toThrow()
    expect(api.getServerFeature('some_flag')).toBe('enforce')
  })

  it('beats the dev localStorage override', () => {
    localStorage.setItem('ff:some_flag', '"from_local_storage"')
    window.history.replaceState({}, '', '/?ff=some_flag:from_url')

    expect(api.getServerFeature('some_flag')).toBe('from_url')
  })

  it('withholds the override from a non-employee', () => {
    mockCurrentUser.value = { email: 'someone@gmail.com', emailVerified: true }
    api.serverFeatureFlags.value = { max_upload_size: 100 }
    window.history.replaceState({}, '', '/?ff=max_upload_size:209715200')

    expect(api.getServerFeature('max_upload_size')).toBe(100)
  })

  it('leaves resolution untouched when no override is requested', () => {
    api.serverFeatureFlags.value = { max_upload_size: 100 }

    expect(api.getServerFeature('max_upload_size')).toBe(100)
    expect(api.getServerFeature('missing', 'DEFAULT')).toBe('DEFAULT')
  })

  it('reports the override through serverSupportsFeature too', () => {
    api.serverFeatureFlags.value = { some_flag: false }
    window.history.replaceState({}, '', '/?ff=some_flag')

    expect(api.serverSupportsFeature('some_flag')).toBe(true)
  })

  it('turns a supported feature off through an explicit false override', () => {
    api.serverFeatureFlags.value = { some_flag: true }
    window.history.replaceState({}, '', '/?ff=some_flag:false')

    expect(api.serverSupportsFeature('some_flag')).toBe(false)
    expect(api.getServerFeature('some_flag')).toBe(false)
  })
})
