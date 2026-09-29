import { describe, expect, it, vi } from 'vitest'
import {
  isExcludedFromSitemap,
  isIndexableModelPage,
  isNoindexPathname
} from './indexing'
import { WAVE_1_ROUTER_IDS_BY_FAMILY } from './model-page-launch'
import {
  routerModelSlugAliases,
  workshopModels
} from './workshop-browse-content'

const MODELS_PAGES_BY_KIND = [
  ['hub', '/models/'],
  ['wave 1 model', '/models/krea--krea-2-large--generate-images/'],
  ['later model', '/models/recraft--v4-text-to-image--generate-images/'],
  ['alias', '/models/krea--krea-2-large/'],
  ['workflow', '/models/workflows/change-material/'],
  ['app', '/models/apps/cinematic-studio/'],
  ['showcase', '/models/showcase/'],
  ['catalogue', '/models/catalogue.json'],
  ['page data', '/models/krea--krea-2-large--generate-images/page.json']
] as const

const wave1RouterIds = new Set<string>(
  Object.values(WAVE_1_ROUTER_IDS_BY_FAMILY).flat()
)

const inSitemap = (pathname: string) =>
  !isExcludedFromSitemap(`https://comfy.org${pathname}`)

describe('indexing policy', () => {
  it('excludes render pages while keeping the public Models marketing routes', () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '1')
    expect(isExcludedFromSitemap('https://comfy.org/models/')).toBe(false)
    expect(
      isExcludedFromSitemap(
        'https://comfy.org/models/recraft--v4-text-to-image--generate-images/'
      )
    ).toBe(true)
    expect(isExcludedFromSitemap('https://comfy.org/models/local/')).toBe(false)
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
    '/zh-CN/login'
  ])('marks %s as noindex', (pathname) => {
    expect(isNoindexPathname(pathname)).toBe(true)
    expect(isExcludedFromSitemap(`https://comfy.org${pathname}`)).toBe(true)
  })

  it.for([
    '/privacy',
    '/pricing',
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

describe('model page launch waves', () => {
  it.for(MODELS_PAGES_BY_KIND)(
    'lists only the hub and wave 1 model pages (%s)',
    ([kind, pathname]) => {
      expect(isIndexableModelPage(pathname)).toBe(kind === 'wave 1 model')
      expect(inSitemap(pathname)).toBe(
        kind === 'hub' || kind === 'wave 1 model'
      )
    }
  )

  it('names only published Router models in wave 1', () => {
    const published = new Set(workshopModels.map(({ routerId }) => routerId))
    expect([...wave1RouterIds].filter((id) => !published.has(id))).toEqual([])
  })

  it('indexes every page of a wave 1 model and no other model page', () => {
    expect(
      workshopModels.filter(({ href }) => isIndexableModelPage(href))
    ).toEqual(
      workshopModels.filter(({ routerId }) => wave1RouterIds.has(routerId))
    )
  })

  it('indexes every canonical model page once all waves launch', () => {
    expect(
      workshopModels.every(({ href }) => isIndexableModelPage(href, 'all'))
    ).toBe(true)
    expect(
      [...routerModelSlugAliases.keys()].some((alias) =>
        isIndexableModelPage(`/models/${alias}/`, 'all')
      )
    ).toBe(false)
  })

  it.for(MODELS_PAGES_BY_KIND)(
    'never indexes a Models page that is not a canonical model page (%s)',
    ([kind, pathname]) => {
      expect(isIndexableModelPage(pathname, 'all')).toBe(
        kind === 'wave 1 model' || kind === 'later model'
      )
    }
  )

  it('indexes no model page when every wave is rolled back', () => {
    expect(
      workshopModels.some(({ href }) => isIndexableModelPage(href, new Set()))
    ).toBe(false)
  })
})
