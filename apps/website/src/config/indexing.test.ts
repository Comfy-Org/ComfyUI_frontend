import { describe, expect, it } from 'vitest'
import {
  isExcludedFromSitemap,
  isIndexableModelPage,
  isNoindexPathname,
  routerIdsByModelPage
} from './indexing'
import {
  buildModelsUrlRegistry,
  modelsUrlEntries,
  modelsUrlPaths
} from './models-url-registry'
import {
  routerModelSlugAliases,
  workshopModels
} from './workshop-browse-content'
import { workflowModels } from './workshop-workflow-content'

const [{ slug: modelSlug }] = workshopModels
const [aliasSlug] = routerModelSlugAliases.keys()

const MODELS_PAGES_BY_KIND = [
  ['hub', '/models/'],
  ['model', `/models/${modelSlug}/`],
  ['alias', `/models/${aliasSlug}/`],
  ['workflow', '/models/workflows/change-material/'],
  ['app', '/models/apps/cinematic-studio/'],
  ['showcase', '/models/showcase/'],
  ['catalogue', '/models/catalogue.json'],
  ['page data', `/models/${modelSlug}/page.json`]
] as const

const inSitemap = (pathname: string) =>
  !isExcludedFromSitemap(`https://comfy.org${pathname}`, 'all', false)

describe('indexing policy', () => {
  it('keeps the public Models marketing routes and drops the showcase render page', () => {
    expect(isExcludedFromSitemap('https://comfy.org/models/')).toBe(false)
    expect(isExcludedFromSitemap('https://comfy.org/models/local/')).toBe(false)
    expect(isExcludedFromSitemap('https://comfy.org/models/showcase/')).toBe(
      true
    )
    expect(isNoindexPathname('/models/showcase/')).toBe(true)
    expect(isNoindexPathname('/zh-CN/models/showcase')).toBe(true)
  })

  it('excludes only the retired Workshop route tree', () => {
    expect(isExcludedFromSitemap('https://comfy.org/workshop/')).toBe(true)
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
    '/zh-CN/login'
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

describe('model page launch', () => {
  it.for(MODELS_PAGES_BY_KIND)(
    'lists only the hub and canonical model pages (%s)',
    ([kind, pathname]) => {
      expect(isIndexableModelPage(pathname, 'all', false)).toBe(
        kind === 'model'
      )
      expect(inSitemap(pathname)).toBe(kind === 'hub' || kind === 'model')
    }
  )

  it('indexes every canonical model page and no alias', () => {
    expect(
      workshopModels.every(({ href }) => isIndexableModelPage(href, 'all'))
    ).toBe(true)
    expect(
      [...routerModelSlugAliases.keys()].some((alias) =>
        isIndexableModelPage(`/models/${alias}/`, 'all', true)
      )
    ).toBe(false)
  })

  it('rolls back to only the model pages of the Router ids it keeps', () => {
    const kept = new Set(['krea/krea-2-large'])
    const expected = workshopModels
      .filter(({ routerId }) => kept.has(routerId))
      .map(({ slug }) => slug)
    expect(expected).not.toHaveLength(0)
    expect(
      workshopModels
        .filter(({ href }) => isIndexableModelPage(href, kept))
        .map(({ slug }) => slug)
    ).toEqual(expected)
    expect(
      workshopModels.some(({ href }) => isIndexableModelPage(href, new Set()))
    ).toBe(false)
    expect(
      workshopModels.some(
        ({ href }) =>
          !isExcludedFromSitemap(`https://comfy.org${href}`, new Set(), false)
      )
    ).toBe(false)
  })

  it('keeps workflow pages hidden until their switch launches them', () => {
    const workflowPaths = workflowModels.map(({ slug }) => `/models/${slug}/`)
    expect(workflowPaths.length).toBeGreaterThan(0)
    expect(
      workflowPaths.some((path) => isIndexableModelPage(path, 'all', false))
    ).toBe(false)
    expect(
      workflowPaths.every((path) => isIndexableModelPage(path, 'all', true))
    ).toBe(true)
    expect(
      workshopModels.every(({ href }) =>
        isIndexableModelPage(href, 'all', false)
      )
    ).toBe(true)
  })

  it('fails loudly when model page URLs drift from the Router id map', () => {
    const movedModelPaths = modelsUrlPaths(
      'model',
      buildModelsUrlRegistry(
        modelsUrlEntries(
          {
            models: workshopModels.map(({ slug }) => slug),
            workflows: [],
            apps: [],
            aliases: new Map()
          },
          '/hub/models'
        ),
        ['/hub/models']
      )
    )
    expect(() => routerIdsByModelPage(movedModelPaths, workshopModels)).toThrow(
      'Model pages with no Router id'
    )
    expect(
      routerIdsByModelPage(modelsUrlPaths('model'), workshopModels).size
    ).toBe(workshopModels.length)
  })
})
