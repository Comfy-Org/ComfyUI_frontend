import { describe, expect, it } from 'vitest'

import { LOCALE_CODES } from '@/config/locales'
import {
  CATALOG_LOCALES,
  CATALOG_LOCALE_OPTIONS,
  PREFIXED_CATALOG_LOCALES,
  catalogLocaleBadge,
  catalogLocaleFromPath,
  catalogLocalePrefix,
  isCatalogLocale,
  resolveCatalogLocale,
  withCatalogLocalePrefix,
  withoutCatalogLocalePrefix
} from './catalog-locales'
import { catalogDetailPath } from '@/lib/cms/detail-route'

describe('catalog locales', () => {
  it('serves every site locale, so ja is not left out', () => {
    expect(CATALOG_LOCALES).toEqual(LOCALE_CODES)
    expect(CATALOG_LOCALES).toEqual(
      expect.arrayContaining(['en', 'zh-CN', 'ja'])
    )
    expect(PREFIXED_CATALOG_LOCALES).toEqual(
      CATALOG_LOCALES.filter((locale) => locale !== 'en')
    )
    expect(CATALOG_LOCALE_OPTIONS.map(({ code }) => code)).toEqual(
      CATALOG_LOCALES
    )
  })

  it('rejects anything that is not a site locale', () => {
    for (const value of ['ja', 'zh-CN', 'en'])
      expect(isCatalogLocale(value)).toBe(true)
    for (const value of ['ko', 'zh-cn', '', undefined, 3, '__proto__'])
      expect(isCatalogLocale(value)).toBe(false)
  })

  it('reads the locale from a whole path segment, then the cookie, then English', () => {
    expect(resolveCatalogLocale('/ja/hub/workflows/', undefined)).toBe('ja')
    expect(resolveCatalogLocale('/ja', undefined)).toBe('ja')
    expect(resolveCatalogLocale('/zh-CN/hub/models/x/', 'ja')).toBe('zh-CN')
    expect(resolveCatalogLocale('/hub/models/x/', 'ja')).toBe('ja')
    expect(resolveCatalogLocale('/hub/models/x/', 'ko')).toBe('en')
    expect(resolveCatalogLocale('/japan/hub/', undefined)).toBe('en')
    expect(catalogLocaleFromPath('/zh-CN-guide/')).toBeUndefined()
  })

  it('prefixes paths once and leaves English unprefixed', () => {
    expect(catalogLocalePrefix('en')).toBe('')
    expect(catalogLocalePrefix('ja')).toBe('/ja')
    expect(catalogLocalePrefix('ko')).toBe('')
    expect(withCatalogLocalePrefix('/hub/workflows/a/', 'ja')).toBe(
      '/ja/hub/workflows/a/'
    )
    expect(withCatalogLocalePrefix('/ja/hub/workflows/a/', 'ja')).toBe(
      '/ja/hub/workflows/a/'
    )
    expect(withCatalogLocalePrefix('/hub/workflows/a/', 'en')).toBe(
      '/hub/workflows/a/'
    )
  })

  it('gives each locale a compact badge', () => {
    expect(['en', 'zh-CN', 'ja'].map(catalogLocaleBadge)).toEqual([
      'EN',
      '中',
      '日'
    ])
  })

  it('strips any catalog locale prefix so localized Hub routes resolve', () => {
    expect(withoutCatalogLocalePrefix('/ja/hub/workflows/a/')).toBe(
      '/hub/workflows/a/'
    )
    expect(withoutCatalogLocalePrefix('/zh-CN/hub/workflows')).toBe(
      '/hub/workflows'
    )
    expect(withoutCatalogLocalePrefix('/ja')).toBe('/')
    expect(withoutCatalogLocalePrefix('/japan/hub/')).toBe('/japan/hub/')
    for (const path of [
      '/hub/workflows/a/',
      '/zh-CN/hub/models/b',
      '/ja/hub/workflows/a/'
    ])
      expect(catalogDetailPath(path)).toBe(true)
    for (const path of [
      '/ko/hub/workflows/a/',
      '/ja/hub/apps/a/',
      '/ja/hub/workflows/'
    ])
      expect(catalogDetailPath(path)).toBe(false)
  })
})
