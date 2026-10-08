import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { websiteRoot } from '@website/paths'
import { modelsBuildRoutes } from '@/integrations/workshop-release-gate'
import { routeOf } from '@/utils/hreflangRoutes'
import hubAppNames from './hub-app-names.json' with { type: 'json' }
import hubWorkflowNames from './hub-workflow-names.json' with { type: 'json' }
import { hubModelAliases } from './hub-models'
import { localModelPath, localModels } from './local-models'
import { modelAliasUrls, modelPageUrls } from './model-urls'
import { modelsUrlKind } from './models-url-registry'
import {
  astroRedirects,
  isInternalDestination,
  siteRedirects,
  toVercelRedirects
} from './redirects'
import { getRoutes } from './routes'

const pagesDir = join(websiteRoot, 'src', 'pages')

const astroFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return astroFiles(full)
    return entry.name.endsWith('.astro') && !entry.name.startsWith('_')
      ? [full]
      : []
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
  ...localModels.map((model) => localModelPath(model.slug))
])

const pageExistsAt = (pathname: string) => builtPages.has(pathname)

const VercelConfigSchema = z.object({
  redirects: z.array(z.unknown()),
  headers: z.array(z.unknown()).default([]),
  rewrites: z.array(z.unknown()).default([])
})

const vercelConfig = VercelConfigSchema.parse(
  JSON.parse(readFileSync(join(websiteRoot, 'vercel.json'), 'utf8'))
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

  it('writes sources as paths without a trailing slash, literal or with one slug group', () => {
    expect(
      sources.filter(
        (source) =>
          !/^(\/[A-Za-z0-9._-]+)+$/.test(source) &&
          !/^\/p\/supported-models\/:slug\([a-z0-9|-]+\)(\.md)?$/.test(source)
      )
    ).toEqual([])
  })

  it('ends every internal destination with a trailing slash, unless it is a file', () => {
    expect(
      siteRedirects
        .map(({ destination }) => destination)
        .filter(
          (destination) =>
            isInternalDestination(destination) &&
            !destination.endsWith('/') &&
            !/\.(md|txt)$/.test(destination)
        )
    ).toEqual([])
  })

  it('leaves every /workflows/ address to the router', () => {
    expect(
      sources.filter((source) => source.startsWith('/workflows/'))
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
      destination: '/hub/models/local/t5xxl-fp16/'
    },
    { source: '/p/supported-models', destination: '/hub/models/local/' },
    { source: '/models', destination: '/hub/models/' },
    {
      source: '/models/workflows/change-material',
      destination: '/hub/workflows/change-material/'
    },
    {
      source: '/models/bfl--flux-2-max--generate-images',
      destination: '/hub/models/flux-2-max-text-to-image/'
    },
    {
      source: '/models/byteplus--seedance-2-5-text-to-video--generate-videos',
      destination: '/hub/models/seedance-2-5-text-to-video/'
    },
    {
      source: '/models/vertexai--gemini-3-pro-image',
      destination: `/hub/models/${hubModelAliases.get('vertexai--gemini-3-pro-image')}/`
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
      '/zh-CN/minimax/',
      '/gallery',
      '/gallery/',
      '/gallery.md',
      '/zh-CN/gallery',
      '/zh-CN/gallery/',
      '/zh-CN/gallery.md',
      '/launches',
      '/launches/',
      '/launches.md',
      '/zh-CN/launches',
      '/zh-CN/launches/',
      '/zh-CN/launches.md'
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

describe('the parked pages', () => {
  it.for([
    ['/gallery', '/customers/'],
    ['/zh-CN/gallery', '/zh-CN/customers/'],
    ['/launches', '/events/'],
    ['/zh-CN/launches', '/zh-CN/events/'],
    ['/gallery.md', '/customers.md'],
    ['/zh-CN/gallery.md', '/zh-CN/customers.md'],
    ['/launches.md', '/events.md'],
    ['/zh-CN/launches.md', '/zh-CN/events.md']
  ])('sends %s to %s with a 307', ([source, destination]) => {
    expect(
      toVercelRedirects(siteRedirects).find((row) => row.source === source)
    ).toMatchObject({ destination, permanent: false })
  })
})

describe('Astro redirects', () => {
  it('cover every internal row whose slash form redirects, except retired addresses', () => {
    const isRetiredAddress = (source: string) =>
      ['/models', '/p/supported-models'].some(
        (root) =>
          source === root ||
          source.startsWith(`${root}/`) ||
          source.startsWith(`${root}.`)
      )
    expect(Object.keys(astroRedirects)).toEqual(
      siteRedirects
        .filter(
          ({ source, destination, slashFormIsPageBecause }) =>
            isInternalDestination(destination) &&
            slashFormIsPageBecause === undefined &&
            !/\.(md|txt)$/.test(source) &&
            !isRetiredAddress(source)
        )
        .map(({ source }) => source)
    )
    expect(astroRedirects['/minimax']).toEqual({
      status: 307,
      destination: '/minimax-h3/'
    })
    expect(astroRedirects['/zh-CN/minimax']).toEqual({
      status: 307,
      destination: '/zh-CN/minimax-h3/'
    })
    expect(astroRedirects['/gallery.md']).toBeUndefined()
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

describe('old Models addresses', () => {
  const vercelRedirects = toVercelRedirects(siteRedirects)
  const frozenDestinations: [string, string][] = [
    ['/models', '/hub/models/'],
    ...modelPageUrls.map(({ oldSlug, newSlug }): [string, string] => [
      `/models/${oldSlug}`,
      `/hub/models/${newSlug}/`
    ]),
    ...modelAliasUrls.map(({ alias, newSlug }): [string, string] => [
      `/models/${alias}`,
      `/hub/models/${newSlug}/`
    ]),
    ...hubWorkflowNames.map((name): [string, string] => [
      `/models/workflows/${name}`,
      `/hub/workflows/${name}/`
    ]),
    ...hubAppNames.map((name): [string, string] => [
      `/models/apps/${name}`,
      `/hub/apps/${name}/`
    ])
  ].flatMap(([path, destination]) => [
    [path, destination],
    [`${path}/`, destination]
  ])

  it('each redirect once, permanently, to the page in the frozen URL tables', () => {
    const served = (path: string) =>
      vercelRedirects
        .filter(({ source }) => source === path)
        .map(({ permanent, destination }) =>
          permanent ? destination : `temporary ${destination}`
        )
    expect(
      Object.fromEntries(
        frozenDestinations.map(([path]) => [path, served(path)])
      )
    ).toEqual(
      Object.fromEntries(
        frozenDestinations.map(([path, destination]) => [path, [destination]])
      )
    )
  })

  it('each is an alias in the Models URL registry', () => {
    expect(
      frozenDestinations
        .map(([path]) => path)
        .filter((path) => modelsUrlKind(path) !== 'alias')
    ).toEqual([])
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
