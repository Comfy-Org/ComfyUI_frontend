import { describe, expect, it, vi } from 'vitest'
import {
  isExcludedFromSitemap,
  isIndexableModelPage,
  isNoindexPathname
} from './indexing'
import {
  routerModelSlugAliases,
  workshopModels
} from './workshop-browse-content'
import { workflowModels } from './workshop-workflow-content'

const MODELS_PAGES_BY_KIND = [
  ['hub', '/models/'],
  ['model', '/models/krea--krea-2-large--generate-images/'],
  ['alias', '/models/krea--krea-2-large/'],
  ['workflow', '/models/workflows/change-material/'],
  ['app', '/models/apps/cinematic-studio/'],
  ['showcase', '/models/showcase/'],
  ['catalogue', '/models/catalogue.json'],
  ['page data', '/models/krea--krea-2-large--generate-images/page.json']
] as const

const inSitemap = (pathname: string) =>
  !isExcludedFromSitemap(`https://comfy.org${pathname}`)

describe('indexing policy', () => {
  it('keeps the public Models marketing routes and drops the showcase render page', () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '1')
    expect(isExcludedFromSitemap('https://comfy.org/models/')).toBe(false)
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

describe('model page launch', () => {
  it.for(MODELS_PAGES_BY_KIND)(
    'lists only the hub and canonical model pages (%s)',
    ([kind, pathname]) => {
      expect(isIndexableModelPage(pathname)).toBe(kind === 'model')
      expect(inSitemap(pathname)).toBe(kind === 'hub' || kind === 'model')
    }
  )

  it('indexes every canonical model page and no alias', () => {
    expect(workshopModels.every(({ href }) => isIndexableModelPage(href))).toBe(
      true
    )
    expect(
      [...routerModelSlugAliases.keys()].some((alias) =>
        isIndexableModelPage(`/models/${alias}/`)
      )
    ).toBe(false)
  })

  it('rolls back to only the model pages of the Router ids it keeps', () => {
    const kept = new Set(['krea/krea-2-large'])
    expect(
      workshopModels
        .filter(({ href }) => isIndexableModelPage(href, kept))
        .map(({ slug }) => slug)
    ).toEqual(['krea--krea-2-large--generate-images'])
    expect(
      workshopModels.some(({ href }) => isIndexableModelPage(href, new Set()))
    ).toBe(false)
  })

  it('keeps workflow pages hidden until their switch launches them', () => {
    const workflowPaths = workflowModels.map(({ slug }) => `/models/${slug}/`)
    expect(workflowPaths.length).toBeGreaterThan(0)
    expect(workflowPaths.some((path) => isIndexableModelPage(path))).toBe(false)
    expect(
      workflowPaths.every((path) => isIndexableModelPage(path, 'all', true))
    ).toBe(true)
    expect(
      workshopModels.every(({ href }) =>
        isIndexableModelPage(href, 'all', false)
      )
    ).toBe(true)
  })
})
