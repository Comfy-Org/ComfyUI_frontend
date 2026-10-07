import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { websiteRoot } from '@website/paths'
import { modelsBuildRoutes } from '@/integrations/workshop-release-gate'
import { routeOf } from '@/utils/hreflangRoutes'
import {
  NOINDEX_ROUTES,
  headIndexing,
  isExcludedFromSitemap,
  isIndexableBuild,
  isIndexableModelPage,
  isNoindexPathname,
  routerIdsByModelPage
} from './indexing'
import { hubModelSlugs, hubWorkflowHref } from './hub-models'
import { modelsUrlPaths } from './models-url-registry'
import {
  routerModelSlugAliases,
  workshopModels
} from './workshop-browse-content'
import { workflowModels } from './workshop-workflow-content'

const [hubModelSlug] = hubModelSlugs.values()
const [{ slug: modelSlug }] = workshopModels
const [aliasSlug] = routerModelSlugAliases.keys()
const modelPages = workshopModels.flatMap(({ href, routerId, slug }) =>
  href === undefined ? [] : [{ href, routerId, slug }]
)

const MODELS_PAGES_BY_KIND = [
  ['hub', '/hub/models/'],
  ['section', '/hub/workflows/'],
  ['section', '/hub/apps/'],
  ['model', `/hub/models/${hubModelSlug}/`],
  ['alias', '/models/'],
  ['alias', `/models/${modelSlug}/`],
  ['alias', `/models/${aliasSlug}/`],
  ['workflow', '/hub/workflows/change-material/'],
  ['app', '/hub/apps/cinematic-studio/'],
  ['showcase', '/models/showcase/'],
  ['catalogue', '/models/catalogue.json'],
  ['page data', `/models/${modelSlug}/page.json`]
] as const

const inSitemap = (pathname: string) =>
  !isExcludedFromSitemap(`https://comfy.org${pathname}`, 'all', false)

describe('indexing policy', () => {
  it('keeps the public Models routes and drops the showcase render page', () => {
    expect(isExcludedFromSitemap('https://comfy.org/hub/models/')).toBe(false)
    expect(isExcludedFromSitemap('https://comfy.org/models/')).toBe(true)
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
    '/hub/models/local/',
    '/hub/models/local/4x-ultrasharp/',
    '/demos/image-to-video'
  ])('keeps %s indexable', (pathname) => {
    expect(isNoindexPathname(pathname)).toBe(false)
    expect(isExcludedFromSitemap(`https://comfy.org${pathname}`)).toBe(false)
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
    'keeps every Models page but the hub out of the sitemap with nothing launched (%s)',
    ([kind, pathname]) => {
      expect(isIndexableModelPage(pathname, new Set(), false)).toBe(false)
      expect(
        !isExcludedFromSitemap(`https://comfy.org${pathname}`, new Set(), false)
      ).toBe(kind === 'hub')
    }
  )
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
      modelPages.every(({ href }) => isIndexableModelPage(href, 'all'))
    ).toBe(true)
    expect(
      [...routerModelSlugAliases.keys()].some((alias) =>
        isIndexableModelPage(`/models/${alias}/`, 'all', true)
      )
    ).toBe(false)
  })

  it('rolls back to only the model pages of the Router ids it keeps', () => {
    const kept = new Set(['krea/krea-2-large'])
    const expected = modelPages
      .filter(({ routerId }) => kept.has(routerId))
      .map(({ slug }) => slug)
    expect(expected).not.toHaveLength(0)
    expect(
      modelPages
        .filter(({ href }) => isIndexableModelPage(href, kept))
        .map(({ slug }) => slug)
    ).toEqual(expected)
    expect(
      modelPages.some(({ href }) => isIndexableModelPage(href, new Set()))
    ).toBe(false)
    expect(
      modelPages.some(
        ({ href }) =>
          !isExcludedFromSitemap(`https://comfy.org${href}`, new Set(), false)
      )
    ).toBe(false)
  })

  it('keeps workflow pages hidden until their switch launches them', () => {
    const workflowPaths = workflowModels.map(({ slug }) =>
      hubWorkflowHref(slug)
    )
    expect(workflowPaths.length).toBeGreaterThan(0)
    expect(
      workflowPaths.some((path) => isIndexableModelPage(path, 'all', false))
    ).toBe(false)
    expect(
      workflowPaths.every((path) => isIndexableModelPage(path, 'all', true))
    ).toBe(true)
    expect(
      modelPages.every(({ href }) => isIndexableModelPage(href, 'all', false))
    ).toBe(true)
  })

  it.for([
    { path: '/hub/workflows/', workflowsLaunched: false },
    { path: '/hub/workflows/', workflowsLaunched: true },
    { path: '/hub/apps/', workflowsLaunched: false },
    { path: '/hub/apps/', workflowsLaunched: true }
  ])(
    'keeps $path out of the index with workflows launched $workflowsLaunched',
    ({ path, workflowsLaunched }) => {
      expect(isIndexableModelPage(path, 'all', workflowsLaunched)).toBe(false)
      expect(
        isExcludedFromSitemap(
          `https://comfy.org${path}`,
          'all',
          workflowsLaunched
        )
      ).toBe(true)
    }
  )

  it('fails loudly when model page URLs drift from the Router id map', () => {
    const movedModelPaths = modelPages.map(({ slug }) => `/models/${slug}`)
    expect(() => routerIdsByModelPage(movedModelPaths, modelPages)).toThrow(
      'Model pages with no Router id'
    )
    expect(routerIdsByModelPage(modelsUrlPaths('model'), modelPages).size).toBe(
      modelPages.length
    )
  })
})

const pagesDir = join(websiteRoot, 'src/pages')

const astroFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return astroFiles(full)
    return entry.name.endsWith('.astro') ? [full] : []
  })

const pageRoute = (file: string) =>
  routeOf(`/src/pages/${relative(pagesDir, file).split(sep).join('/')}`)

describe('pages that are noindex on their own', () => {
  const isNoindexOnItsOwn = (file: string) => {
    const source = readFileSync(file, 'utf8')
    return (
      /\bAuthLayout\b/.test(source) ||
      /\snoindex(?=[\s/>=])/.test(source.replace(/^---[\s\S]*?\n---/, ''))
    )
  }

  const routes = astroFiles(pagesDir)
    .filter(isNoindexOnItsOwn)
    .map(pageRoute)
    .filter((route) => route !== '/404/')

  it('finds the pages that pass the prop or use AuthLayout', () => {
    expect(routes).toContain('/privacy-policy/')
    expect(routes).toContain('/comfy-agent/')
    expect(routes).toContain('/login/')
  })

  it.for(routes)('lists %s in NOINDEX_ROUTES', (route) => {
    expect(isNoindexPathname(route)).toBe(true)
  })
})

describe('NOINDEX_ROUTES', () => {
  const toMatcher = (route: string) =>
    new RegExp(
      `^${route
        .replace(/\/$/, '')
        .split('/')
        .filter(Boolean)
        .map((segment) =>
          segment.startsWith('[...')
            ? '(?:/.*)?'
            : segment.startsWith('[')
              ? '/[^/]+'
              : `/${segment.replace(/[.*+?^${}()|\\]/g, '\\$&')}`
        )
        .join('')}$`
    )

  const builtRoutes = [
    ...astroFiles(pagesDir).map(pageRoute),
    ...modelsBuildRoutes(true).map(({ pattern }) => pattern)
  ].map(toMatcher)

  it.for(NOINDEX_ROUTES)('%s is a route this site builds', (route) => {
    expect(builtRoutes.some((matcher) => matcher.test(route))).toBe(true)
  })
})
