import { beforeEach, describe, expect, it, vi } from 'vitest'

const distribution = vi.hoisted(() => ({
  isCloud: false,
  isDesktop: false
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distribution.isCloud
  },
  get isDesktop() {
    return distribution.isDesktop
  }
}))

import { getCheckoutPlatformSource } from '../platformSource'

describe('getCheckoutPlatformSource', () => {
  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
    window.localStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('classifies cloud checkout launched from desktop', () => {
    distribution.isCloud = true
    window.history.pushState({}, '', '/pricing?utm_source=comfy.desktop')

    expect(getCheckoutPlatformSource()).toBe('desktop_cloud')
  })

  it('classifies direct cloud checkout', () => {
    distribution.isCloud = true

    expect(getCheckoutPlatformSource()).toBe('cloud')
  })

  it('classifies cloud checkout from persisted desktop attribution', () => {
    distribution.isCloud = true
    window.localStorage.setItem(
      'comfy_checkout_attribution',
      JSON.stringify({ utm_source: 'comfy.desktop' })
    )

    expect(getCheckoutPlatformSource()).toBe('desktop_cloud')
  })

  it('prefers current URL attribution over stored attribution', () => {
    distribution.isCloud = true
    window.localStorage.setItem(
      'comfy_checkout_attribution',
      JSON.stringify({ utm_source: 'comfy.desktop' })
    )
    window.history.pushState({}, '', '/pricing?utm_source=direct')

    expect(getCheckoutPlatformSource()).toBe('cloud')
  })

  it('classifies desktop local checkout', () => {
    distribution.isDesktop = true

    expect(getCheckoutPlatformSource()).toBe('desktop_local')
  })

  it('does not classify OSS browser checkout', () => {
    expect(getCheckoutPlatformSource()).toBeUndefined()
  })
})
