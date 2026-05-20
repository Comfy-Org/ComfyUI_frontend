import { describe, expect, it } from 'vitest'

import { externalLinks, getRoutes } from './routes'

describe('getRoutes', () => {
  it('returns base routes unchanged for the default locale', () => {
    const routes = getRoutes()
    expect(routes.home).toBe('/')
    expect(routes.careers).toBe('/careers')
    expect(routes.termsOfService).toBe('/terms-of-service')
    expect(routes.privacyPolicy).toBe('/privacy-policy')
    expect(routes.cloud).toBe('/cloud')
  })

  it('returns base routes unchanged for the "en" locale', () => {
    const routes = getRoutes('en')
    expect(routes.home).toBe('/')
    expect(routes.careers).toBe('/careers')
    expect(routes.termsOfService).toBe('/terms-of-service')
    expect(routes.download).toBe('/download')
    expect(routes.about).toBe('/about')
  })

  it('prefixes all routes with /zh-CN for the zh-CN locale', () => {
    const routes = getRoutes('zh-CN')
    expect(routes.home).toBe('/zh-CN/')
    expect(routes.careers).toBe('/zh-CN/careers')
    expect(routes.cloud).toBe('/zh-CN/cloud')
    expect(routes.download).toBe('/zh-CN/download')
    expect(routes.about).toBe('/zh-CN/about')
  })

  it('prefixes termsOfService with locale for zh-CN (no longer locale-invariant)', () => {
    const routes = getRoutes('zh-CN')
    // Previously termsOfService was excluded from locale prefixing;
    // after the PR change it is now prefixed like all other routes.
    expect(routes.termsOfService).toBe('/zh-CN/terms-of-service')
  })

  it('prefixes privacyPolicy with locale for zh-CN', () => {
    const routes = getRoutes('zh-CN')
    expect(routes.privacyPolicy).toBe('/zh-CN/privacy-policy')
  })

  it('prefixes all keys for non-en locale', () => {
    const enRoutes = getRoutes('en')
    const zhRoutes = getRoutes('zh-CN')
    const keys = Object.keys(enRoutes) as (keyof typeof enRoutes)[]
    for (const key of keys) {
      expect(zhRoutes[key]).toBe(`/zh-CN${enRoutes[key]}`)
    }
  })

  it('returns the same object reference for "en" locale', () => {
    const routes1 = getRoutes('en')
    const routes2 = getRoutes('en')
    // Both calls for 'en' return the shared baseRoutes reference
    expect(routes1).toBe(routes2)
  })

  it('contains all expected route keys', () => {
    const routes = getRoutes()
    const expectedKeys = [
      'home',
      'download',
      'cloud',
      'cloudPricing',
      'cloudEnterprise',
      'api',
      'gallery',
      'about',
      'careers',
      'customers',
      'demos',
      'termsOfService',
      'privacyPolicy',
      'contact',
      'models'
    ]
    for (const key of expectedKeys) {
      expect(routes).toHaveProperty(key)
    }
  })
})

describe('externalLinks', () => {
  it('does not contain a cloudStatus property', () => {
    expect(externalLinks).not.toHaveProperty('cloudStatus')
  })

  it('contains the expected external links', () => {
    expect(externalLinks.cloud).toBe('https://cloud.comfy.org')
    expect(externalLinks.discord).toMatch(/discord\.com/)
    expect(externalLinks.docs).toMatch(/docs\.comfy\.org/)
    expect(externalLinks.github).toMatch(/github\.com/)
    expect(externalLinks.blog).toMatch(/blog\.comfy\.org/)
  })

  it('all values are non-empty strings', () => {
    for (const [key, value] of Object.entries(externalLinks)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })
})
