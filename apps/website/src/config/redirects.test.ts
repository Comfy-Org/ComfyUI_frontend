import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  astroRedirects,
  isInternalDestination,
  siteRedirects,
  toVercelRedirects
} from './redirects'
import { hubModelAliases, hubModelSlugs } from './hub-models'
import { modelsUrlKind } from './models-url-registry'
import { getRoutes } from './routes'

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

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
    { source: '/minimax', destination: `${en.minimax}/` },
    { source: '/zh-CN/minimax', destination: `${zh.minimax}/` },
    { source: '/cloud/enterprise', destination: `${en.enterprise}/` },
    { source: '/zh-CN/affiliates', destination: '/affiliates/' },
    {
      source: '/p/supported-models/t5xxl-fp8-e4m3fn-scaled',
      destination: '/p/supported-models/t5xxl-fp16/'
    },
    { source: '/models', destination: '/hub/models/' },
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
      '/share-news-pleaseeee/'
    ])
  })

  it('leaves /login/ to the Workshop sign-in page', () => {
    expect(find('/login')?.permanent).toBe(false)
    expect(find('/login/')).toBeUndefined()
  })

  it.for([en.minimax, zh.minimax, en.enterprise, zh.enterprise, en.pricing])(
    'leaves the destination %s unredirected',
    (path) => {
      expect(find(path)).toBeUndefined()
      expect(find(`${path}/`)).toBeUndefined()
    }
  )
})

describe('Astro redirects', () => {
  it('cover every internal row whose slash form redirects, except old Models addresses', () => {
    const isOldModelsAddress = (source: string) =>
      source === '/models' || source.startsWith('/models/')
    expect(Object.keys(astroRedirects)).toEqual(
      siteRedirects
        .filter(
          ({ source, destination, slashFormIsPageBecause }) =>
            isInternalDestination(destination) &&
            slashFormIsPageBecause === undefined &&
            !isOldModelsAddress(source)
        )
        .map(({ source }) => source)
    )
  })

  it('leave off-site rows to Vercel', () => {
    expect(astroRedirects['/blog']).toBeUndefined()
    expect(astroRedirects['/login']).toBeUndefined()
  })
})

describe('old Models addresses', () => {
  const vercelRedirects = toVercelRedirects(siteRedirects)
  const oldPaths = [
    '/models',
    ...[...hubModelSlugs.keys(), ...hubModelAliases.keys()].map(
      (slug) => `/models/${slug}`
    )
  ].flatMap((path) => [path, `${path}/`])

  it('each redirect once, permanently, to a page the site builds', () => {
    const landsOnPage = (destination: string) =>
      ['model', 'hub'].includes(modelsUrlKind(destination) ?? '')
    expect(
      oldPaths.filter((path) => {
        const rows = vercelRedirects.filter(({ source }) => source === path)
        return (
          modelsUrlKind(path) !== 'alias' ||
          rows.length !== 1 ||
          !rows[0].permanent ||
          !landsOnPage(rows[0].destination)
        )
      })
    ).toEqual([])
  })
})
