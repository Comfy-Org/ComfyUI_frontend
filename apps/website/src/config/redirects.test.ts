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
      sources.filter((source) => source.endsWith('/') || /[:*(]/.test(source))
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
    { source: '/cloud/enterprise', destination: '/enterprise/' },
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

  it.for(['/minimax-h3', '/enterprise', '/zh-CN/enterprise', '/pricing'])(
    'leaves the destination %s unredirected',
    (path) => {
      expect(find(path)).toBeUndefined()
      expect(find(`${path}/`)).toBeUndefined()
    }
  )
})

describe('Astro redirects', () => {
  it('cover every internal row, so local preview matches Vercel', () => {
    expect(Object.keys(astroRedirects)).toEqual(
      siteRedirects
        .filter(({ destination }) => isInternalDestination(destination))
        .map(({ source }) => source)
    )
  })

  it('leave off-site rows to Vercel', () => {
    expect(astroRedirects['/blog']).toBeUndefined()
    expect(astroRedirects['/login']).toBeUndefined()
  })
})
