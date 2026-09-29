import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

import { routeOf } from '../utils/hreflangRoutes'
import { isExcludedFromSitemap, isNoindexPathname } from './indexing'

describe('indexing policy', () => {
  it('excludes render pages while keeping the public Models marketing routes', () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '1')
    expect(isExcludedFromSitemap('https://comfy.org/models/')).toBe(false)
    expect(isExcludedFromSitemap('https://comfy.org/models/example/')).toBe(
      true
    )
    expect(isExcludedFromSitemap('https://comfy.org/models/showcase/')).toBe(
      true
    )
    expect(isNoindexPathname('/models/showcase/')).toBe(true)
    expect(isNoindexPathname('/zh-CN/models/showcase')).toBe(true)
    vi.stubEnv('WORKSHOP_IN_BUILD', '0')
    expect(isExcludedFromSitemap('https://comfy.org/models/')).toBe(false)
  })
  it.for(['0', '1'])(
    'excludes retired Workshop in either build (%s)',
    (value) => {
      vi.stubEnv('WORKSHOP_IN_BUILD', value)
      expect(isExcludedFromSitemap('https://comfy.org/workshop/')).toBe(true)
      expect(
        isExcludedFromSitemap('https://comfy.org/workshop/models/example/')
      ).toBe(true)
    }
  )

  it('excludes only the disabled Workshop route tree', () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '0')
    expect(
      isExcludedFromSitemap('https://comfy.org/workshop/models/example/')
    ).toBe(true)
    expect(isExcludedFromSitemap('https://comfy.org/workshops/')).toBe(false)
  })

  it.for([
    '/privacy-policy',
    '/privacy-policy/',
    '/zh-CN/privacy-policy',
    '/ja/privacy-policy/',
    '/terms-of-service',
    '/zh-CN/terms-of-service/',
    '/payment/success',
    '/zh-CN/payment/failed/',
    '/individual-submission',
    '/zh-CN/booking-confirmation/',
    '/comfy-agent',
    '/comfy-agent/',
    '/case-studies',
    '/zh-CN/videos/',
    '/demos',
    '/login',
    '/signup',
    '/forgot-password',
    '/checkout-opening',
    '/zh-CN/checkout-opening/',
    '/checkout-return',
    '/zh-CN/checkout-return/',
    '/zh-CN/login',
    '/platform/serverless-animation/'
  ])('marks %s as noindex', (pathname) => {
    expect(isNoindexPathname(pathname)).toBe(true)
    expect(isExcludedFromSitemap(`https://comfy.org${pathname}`)).toBe(true)
  })

  it.for([
    '/privacy',
    '/pricing',
    '/agent',
    '/agent/',
    '/zh-CN/agent',
    '/zh-CN/agent/',
    '/p/supported-models/grok-imagine',
    '/demos/image-to-video'
  ])('keeps %s indexable', (pathname) => {
    expect(isNoindexPathname(pathname)).toBe(false)
    expect(isExcludedFromSitemap(`https://comfy.org${pathname}`)).toBe(false)
  })

  it('derives model redirect exclusions from canonical model metadata', () => {
    expect(
      isExcludedFromSitemap('https://comfy.org/p/supported-models/qwen-3-8b/')
    ).toBe(true)
    expect(
      isExcludedFromSitemap(
        'https://comfy.org/zh-CN/p/supported-models/grok-image/'
      )
    ).toBe(true)
  })
})

describe('pages that pass the noindex prop', () => {
  const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'pages')

  const astroFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return astroFiles(full)
      return entry.name.endsWith('.astro') ? [full] : []
    })

  const passesNoindex = (file: string) =>
    /\snoindex(?=[\s/>=])/.test(
      readFileSync(file, 'utf8').replace(/^---[\s\S]*?\n---/, '')
    )

  const routes = astroFiles(pagesDir)
    .filter(passesNoindex)
    .map((file) =>
      routeOf(`/src/pages/${relative(pagesDir, file).split(sep).join('/')}`)
    )
    .filter((route) => route !== '/404/')

  it('finds the pages that set the prop', () => {
    expect(routes).toContain('/privacy-policy/')
    expect(routes).toContain('/comfy-agent/')
  })

  it.for(routes)('lists %s in NOINDEX_ROUTES', (route) => {
    expect(isNoindexPathname(route)).toBe(true)
  })
})
