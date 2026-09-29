import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { modelsBuildRoutes } from '../integrations/workshop-release-gate'
import { routeOf } from '../utils/hreflangRoutes'
import { modelPageUrls } from './model-urls'
import { models } from './models'
import {
  astroRedirects,
  isInternalDestination,
  siteRedirects,
  toVercelRedirects
} from './redirects'
import { getRoutes } from './routes'

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const pagesDir = join(appDir, 'src', 'pages')

const astroFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return astroFiles(full)
    return entry.name.endsWith('.astro') ? [full] : []
  })

const builtPages = new Set([
  ...astroFiles(pagesDir)
    .map((file) => relative(pagesDir, file).split(sep).join('/'))
    .filter((file) => !file.includes('['))
    .map((file) => routeOf(`/src/pages/${file}`)),
  ...modelsBuildRoutes(true)
    .map(({ pattern }) => pattern)
    .filter((pattern) => !pattern.includes('['))
    .map((pattern) => `${pattern}/`),
  ...models
    .filter((model) => !model.canonicalSlug)
    .map((model) => `/p/supported-models/${model.slug}/`)
])

const pageExistsAt = (pathname: string) => builtPages.has(pathname)

const VercelConfigSchema = z.object({
  redirects: z.array(z.unknown()),
  headers: z.array(z.unknown()).default([]),
  rewrites: z.array(z.unknown()).default([])
})

const vercelConfig = VercelConfigSchema.parse(
  JSON.parse(readFileSync(join(appDir, 'vercel.json'), 'utf8'))
)

const VERCEL_ROUTE_LIMIT = 2048

const withoutSlash = (path: string) => path.replace(/\/$/, '')

const en = getRoutes('en')
const zh = getRoutes('zh-CN')

describe('vercel.json redirects', () => {
  it('match the list in redirects.ts (run `pnpm --filter @comfyorg/website sync:redirects`)', () => {
    expect(vercelConfig.redirects).toEqual(toVercelRedirects(siteRedirects))
  })

  it('stay under the Vercel route limit', () => {
    const routes =
      vercelConfig.redirects.length +
      vercelConfig.headers.length +
      vercelConfig.rewrites.length
    expect(routes).toBeLessThan(VERCEL_ROUTE_LIMIT)
  })
})

describe('the redirect list', () => {
  const sources = siteRedirects.map(({ source }) => source)

  it('names each source once', () => {
    const duplicates = sources.filter(
      (source, index) => sources.indexOf(source) !== index
    )
    expect(duplicates).toEqual([])
  })

  it('never shadows a built page with a slash form', () => {
    expect(
      siteRedirects
        .filter(
          ({ source, slashFormIsPageBecause }) =>
            slashFormIsPageBecause === undefined && pageExistsAt(`${source}/`)
        )
        .map(({ source }) => source)
    ).toEqual([])
  })

  it('writes sources as literal paths without a trailing slash', () => {
    expect(
      sources.filter((source) => !/^(\/[A-Za-z0-9._-]+)+$/.test(source))
    ).toEqual([])
  })

  it('ends every internal destination with a trailing slash', () => {
    expect(
      siteRedirects
        .map(({ destination }) => destination)
        .filter(
          (destination) =>
            isInternalDestination(destination) && !destination.endsWith('/')
        )
    ).toEqual([])
  })

  it('reaches every destination in one hop', () => {
    const sourceSet = new Set<string>(sources)
    expect(
      siteRedirects.filter(
        ({ destination }) =>
          isInternalDestination(destination) &&
          sourceSet.has(withoutSlash(destination))
      )
    ).toEqual([])
  })
})

describe('generated Vercel rules', () => {
  const vercelRedirects = toVercelRedirects(siteRedirects)
  const find = (source: string) =>
    vercelRedirects.find((redirect) => redirect.source === source)

  it.for([
    { source: '/cloud/enterprise', destination: en.enterprise },
    { source: '/zh-CN/affiliates', destination: '/affiliates/' },
    {
      source: '/p/supported-models/t5xxl-fp8-e4m3fn-scaled',
      destination: '/p/supported-models/t5xxl-fp16/'
    }
  ])(
    'send $source and $source/ to $destination permanently',
    ({ source, destination }) => {
      for (const form of [source, `${source}/`]) {
        expect(find(form)).toEqual({
          source: form,
          destination,
          permanent: true
        })
      }
    }
  )

  it('keeps only the listed rows temporary', () => {
    expect(
      vercelRedirects
        .filter(({ permanent }) => !permanent)
        .map(({ source }) => source)
    ).toEqual([
      '/trust',
      '/trust/',
      '/login',
      '/share-news',
      '/share-news/',
      '/share-news-pleaseeee',
      '/share-news-pleaseeee/',
      '/minimax',
      '/minimax/',
      '/zh-CN/minimax',
      '/zh-CN/minimax/'
    ])
  })

  it('leaves /login/ to the Workshop sign-in page', () => {
    expect(find('/login')?.permanent).toBe(false)
    expect(find('/login/')).toBeUndefined()
  })

  it.for([en.minimax, zh.minimax, en.enterprise, zh.enterprise, en.pricing])(
    'leaves the destination %s unredirected',
    (path) => {
      expect(find(withoutSlash(path))).toBeUndefined()
      expect(find(`${withoutSlash(path)}/`)).toBeUndefined()
    }
  )
})

describe('Astro redirects', () => {
  it('cover the internal rows plus one per model alias', () => {
    const aliasCount = models.filter((model) => model.canonicalSlug).length
    expect(Object.keys(astroRedirects)).toHaveLength(18 + aliasCount)
    expect(astroRedirects['/minimax']).toEqual({
      status: 307,
      destination: '/minimax-h3/'
    })
    expect(astroRedirects['/zh-CN/minimax']).toEqual({
      status: 307,
      destination: '/zh-CN/minimax-h3/'
    })
    expect(astroRedirects['/career']).toEqual({
      status: 308,
      destination: '/careers/'
    })
  })

  it('leave off-site rows to Vercel', () => {
    expect(astroRedirects['/blog']).toBeUndefined()
    expect(astroRedirects['/login']).toBeUndefined()
  })
})

function sourcePattern(source: string): RegExp {
  const pattern = source
    .replace(/\[\.\.\.[^\]]+\]|:[\w]+[*+]/g, '.*')
    .replace(/\[[^\]]+\]|:[\w]+/g, '[^/]+')
  return new RegExp(`^${pattern}/?$`)
}

describe('model page data', () => {
  const dataPaths = [
    '/models/catalogue.json',
    ...modelPageUrls.map(({ oldSlug }) => `/models/${oldSlug}/page.json`)
  ]
  const sources = [
    ...toVercelRedirects(siteRedirects).map(({ source }) => source),
    ...Object.keys(astroRedirects)
  ]

  it('recognises a pattern that would swallow the data', () => {
    expect(sourcePattern('/models/:path*').test(dataPaths[1])).toBe(true)
  })

  it('is never matched by a redirect, since /hub/models pages fetch it', () => {
    const swallowed = sources.flatMap((source) =>
      dataPaths.filter((path) => sourcePattern(source).test(path))
    )
    expect(swallowed).toEqual([])
  })
})
