import { describe, expect, it } from 'vitest'

import { externalLinks, getRoutes } from './routes'

describe('getRoutes', () => {
  it('returns the base routes unchanged for the default locale', () => {
    const routes = getRoutes()
    expect(routes.home).toBe('/')
    expect(routes.cloud).toBe('/cloud')
    expect(routes.careers).toBe('/careers')
    expect(routes.termsOfService).toBe('/terms-of-service')
    expect(routes.privacyPolicy).toBe('/privacy-policy')
  })

  it('returns the base routes unchanged for explicit "en" locale', () => {
    const routes = getRoutes('en')
    expect(routes.home).toBe('/')
    expect(routes.download).toBe('/download')
    expect(routes.cloudPricing).toBe('/cloud/pricing')
    expect(routes.termsOfService).toBe('/terms-of-service')
  })

  it('prefixes every route including termsOfService for zh-CN locale', () => {
    const routes = getRoutes('zh-CN')
    // Previously termsOfService was locale-invariant and would NOT get a prefix.
    // After removing localeInvariantRouteKeys, it now receives the prefix too.
    expect(routes.termsOfService).toBe('/zh-CN/terms-of-service')
  })

  it('prefixes all routes for zh-CN locale', () => {
    const routes = getRoutes('zh-CN')
    expect(routes.home).toBe('/zh-CN/')
    expect(routes.cloud).toBe('/zh-CN/cloud')
    expect(routes.cloudPricing).toBe('/zh-CN/cloud/pricing')
    expect(routes.cloudEnterprise).toBe('/zh-CN/cloud/enterprise')
    expect(routes.api).toBe('/zh-CN/api')
    expect(routes.gallery).toBe('/zh-CN/gallery')
    expect(routes.about).toBe('/zh-CN/about')
    expect(routes.careers).toBe('/zh-CN/careers')
    expect(routes.customers).toBe('/zh-CN/customers')
    expect(routes.demos).toBe('/zh-CN/demos')
    expect(routes.privacyPolicy).toBe('/zh-CN/privacy-policy')
    expect(routes.contact).toBe('/zh-CN/contact')
    expect(routes.models).toBe('/zh-CN/p/supported-models')
    expect(routes.download).toBe('/zh-CN/download')
  })

  it('every route value in a non-en locale starts with the locale prefix', () => {
    const routes = getRoutes('zh-CN')
    for (const [key, value] of Object.entries(routes)) {
      expect(value, `route "${key}" should start with /zh-CN`).toMatch(
        /^\/zh-CN\//
      )
    }
  })

  it('en locale routes are the same reference as baseRoutes (identity check)', () => {
    const a = getRoutes('en')
    const b = getRoutes('en')
    // Both calls return the same base object
    expect(a).toBe(b)
  })

  it('non-en locale routes are new objects (not the base reference)', () => {
    const en = getRoutes('en')
    const zhCN = getRoutes('zh-CN')
    expect(zhCN).not.toBe(en)
  })
})

describe('externalLinks', () => {
  it('does not contain cloudStatus (removed in this PR)', () => {
    expect('cloudStatus' in externalLinks).toBe(false)
  })

  it('contains expected external link keys', () => {
    expect(externalLinks.cloud).toBe('https://cloud.comfy.org')
    expect(externalLinks.discord).toMatch(/discord\.com/)
    expect(externalLinks.docs).toMatch(/docs\.comfy\.org/)
    expect(externalLinks.blog).toMatch(/blog\.comfy\.org/)
    expect(externalLinks.github).toMatch(/github\.com\/Comfy-Org/)
    expect(externalLinks.platform).toMatch(/platform\.comfy\.org/)
    expect(externalLinks.support).toMatch(/support\.comfy\.org/)
    expect(externalLinks.apiKeys).toMatch(/platform\.comfy\.org/)
    expect(externalLinks.youtube).toMatch(/youtube\.com/)
  })

  it('all external link values are valid https URLs', () => {
    for (const [key, url] of Object.entries(externalLinks)) {
      expect(url, `externalLinks.${key} should start with https://`).toMatch(
        /^https:\/\//
      )
    }
  })
})