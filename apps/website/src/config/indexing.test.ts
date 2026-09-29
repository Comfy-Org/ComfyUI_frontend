import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  headIndexing,
  isExcludedFromSitemap,
  isIndexableBuild,
  isIndexableModelPage,
  isNoindexPathname
} from './indexing'
import { hubModelSlugs } from './hub-models'
import {
  routerModelSlugAliases,
  workshopModels
} from './workshop-browse-content'

const launch = vi.hoisted(() => ({ MODEL_PAGES_INDEXABLE: false }))
vi.mock(import('./model-page-launch'), () => launch)

const [hubModelSlug] = hubModelSlugs.values()
const [{ slug: modelSlug }] = workshopModels
const [aliasSlug] = routerModelSlugAliases.keys()

const MODELS_PAGES_BY_KIND = [
  ['hub', '/hub/models/'],
  ['model', `/hub/models/${hubModelSlug}/`],
  ['alias', '/models/'],
  ['alias', `/models/${modelSlug}/`],
  ['alias', `/models/${aliasSlug}/`],
  ['workflow', '/hub/workflows/change-material/'],
  ['app', '/models/apps/cinematic-studio/'],
  ['showcase', '/models/showcase/'],
  ['catalogue', '/models/catalogue.json'],
  ['page data', `/models/${modelSlug}/page.json`]
] as const

const inSitemap = (pathname: string) =>
  !isExcludedFromSitemap(`https://comfy.org${pathname}`)

describe('indexing policy', () => {
  it('excludes render pages while keeping the public Models marketing routes', () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '1')
    expect(isExcludedFromSitemap('https://comfy.org/hub/models/')).toBe(false)
    expect(isExcludedFromSitemap('https://comfy.org/models/')).toBe(true)
    expect(
      isExcludedFromSitemap(`https://comfy.org/hub/models/${hubModelSlug}/`)
    ).toBe(true)
    expect(isExcludedFromSitemap('https://comfy.org/models/local/')).toBe(false)
    expect(isExcludedFromSitemap('https://comfy.org/models/showcase/')).toBe(
      true
    )
    expect(isNoindexPathname('/models/showcase/')).toBe(true)
    expect(isNoindexPathname('/zh-CN/models/showcase')).toBe(true)
    vi.stubEnv('WORKSHOP_IN_BUILD', '0')
    expect(isExcludedFromSitemap('https://comfy.org/hub/models/')).toBe(false)
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

  it.for([
    { vercelEnv: 'production', override: undefined, indexable: true },
    { vercelEnv: undefined, override: '1', indexable: true },
    { vercelEnv: 'preview', override: undefined, indexable: false },
    { vercelEnv: 'preview', override: '1', indexable: false },
    { vercelEnv: 'development', override: undefined, indexable: false },
    { vercelEnv: undefined, override: undefined, indexable: false },
    { vercelEnv: '', override: '', indexable: false },
    { vercelEnv: 'Production', override: 'true', indexable: false }
  ])(
    'VERCEL_ENV=$vercelEnv WEBSITE_INDEXABLE=$override is indexable: $indexable',
    ({ vercelEnv, override, indexable }) => {
      vi.stubEnv('VERCEL_ENV', vercelEnv)
      vi.stubEnv('WEBSITE_INDEXABLE', override)
      expect(isIndexableBuild()).toBe(indexable)
    }
  )

  it.for([
    {
      pageNoindex: false,
      indexableBuild: true,
      robotsNoindex: false,
      emitCanonical: true,
      emitAlternates: true,
      emitStructuredData: true,
      emitMarkdownTwinLink: true
    },
    {
      pageNoindex: true,
      indexableBuild: true,
      robotsNoindex: true,
      emitCanonical: true,
      emitAlternates: false,
      emitStructuredData: false,
      emitMarkdownTwinLink: false
    },
    {
      pageNoindex: false,
      indexableBuild: false,
      robotsNoindex: true,
      emitCanonical: false,
      emitAlternates: false,
      emitStructuredData: true,
      emitMarkdownTwinLink: true
    },
    {
      pageNoindex: true,
      indexableBuild: false,
      robotsNoindex: true,
      emitCanonical: false,
      emitAlternates: false,
      emitStructuredData: false,
      emitMarkdownTwinLink: false
    }
  ])(
    'head for pageNoindex=$pageNoindex indexableBuild=$indexableBuild',
    ({ pageNoindex, indexableBuild, ...expected }) => {
      expect(headIndexing({ pageNoindex, indexableBuild })).toEqual(expected)
    }
  )

  it.for(MODELS_PAGES_BY_KIND)(
    'keeps every Models page but the hub out of the sitemap before launch (%s)',
    ([kind, pathname]) => {
      expect(isIndexableModelPage(pathname)).toBe(false)
      expect(inSitemap(pathname)).toBe(kind === 'hub')
    }
  )
})

describe('indexing policy once model pages launch', () => {
  beforeEach(() => {
    launch.MODEL_PAGES_INDEXABLE = true
  })
  afterEach(() => {
    launch.MODEL_PAGES_INDEXABLE = false
  })

  it.for(MODELS_PAGES_BY_KIND)(
    'lists only the hub and canonical model pages (%s)',
    ([kind, pathname]) => {
      expect(isIndexableModelPage(pathname)).toBe(kind === 'model')
      expect(inSitemap(pathname)).toBe(kind === 'hub' || kind === 'model')
    }
  )
})
