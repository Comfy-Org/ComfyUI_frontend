import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { modelAliasUrls, modelPageUrls } from '../src/config/model-urls'
import { redirects } from '../src/config/redirects'
import {
  routerModelSlugAliases,
  workshopModels
} from '../src/config/workshop-browse-content'
import { modelsBuildRoutes } from '../src/integrations/workshop-release-gate'
import {
  MODEL_URL_SLUG,
  MODEL_URL_TABLE,
  MODEL_URLS_MODULE,
  compileModelUrlMap,
  modelUrlSlug,
  renderModelUrlTable,
  renderModelUrlsModule
} from './generate-model-url-map'

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const newSlugs = modelPageUrls.map((page) => page.newSlug)

function sitePathPatterns(): string[] {
  const pagesDir = join(appDir, 'src/pages')
  const pages = readdirSync(pagesDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(astro|ts|mdx?)$/.test(file))
    .filter((file) => !file.split('/').some((part) => part.startsWith('_')))
    .filter((file) => !file.endsWith('.test.ts'))
    .map(
      (file) =>
        `/${file.replace(/\.(astro|ts|mdx?)$/, '').replace(/(^|\/)index$/, '')}`
    )
  const vercel = z
    .object({ redirects: z.array(z.object({ source: z.string() })) })
    .parse(JSON.parse(readFileSync(join(appDir, 'vercel.json'), 'utf8')))
  return [
    ...pages,
    ...modelsBuildRoutes(true).map((route) => route.pattern),
    ...Object.keys(redirects),
    ...vercel.redirects.map((redirect) => redirect.source)
  ]
}

function matchesRoute(pattern: string, path: string): boolean {
  const source = pattern
    .split(/(\[[^\]]+\])/)
    .map((part) =>
      part.startsWith('[...')
        ? '.*'
        : part.startsWith('[')
          ? '[^/]+'
          : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('')
  return new RegExp(`^${source}/?$`).test(path)
}

describe('model URL map', () => {
  it('matches the generator output (pnpm generate:model-url-map)', () => {
    const map = compileModelUrlMap(workshopModels, routerModelSlugAliases)
    expect(readFileSync(MODEL_URLS_MODULE, 'utf8')).toBe(
      renderModelUrlsModule(map)
    )
    expect(readFileSync(MODEL_URL_TABLE, 'utf8')).toBe(
      renderModelUrlTable(workshopModels, map)
    )
  })

  it('gives every published model page exactly one new slug', () => {
    const oldSlugs = modelPageUrls.map((page) => page.oldSlug)
    expect(new Set(oldSlugs).size).toBe(oldSlugs.length)
    expect(oldSlugs.toSorted()).toEqual(
      workshopModels.map((model) => model.slug).toSorted()
    )
  })

  it('points every alias straight at a new page slug', () => {
    const aliases = modelAliasUrls.map((entry) => entry.alias)
    const oldSlugs = new Set(modelPageUrls.map((page) => page.oldSlug))
    expect(new Set(aliases).size).toBe(aliases.length)
    expect(aliases.toSorted()).toEqual(
      [...routerModelSlugAliases.keys()].sort()
    )
    expect(aliases.filter((alias) => oldSlugs.has(alias))).toEqual([])
    expect(
      modelAliasUrls.filter((entry) => !newSlugs.includes(entry.newSlug))
    ).toEqual([])
  })

  it('uses unique, lowercase, hyphenated slugs', () => {
    expect(new Set(newSlugs).size).toBe(newSlugs.length)
    expect(newSlugs.filter((slug) => !MODEL_URL_SLUG.test(slug))).toEqual([])
  })

  it.for([
    [
      'a Router provider id',
      /(^|-)(byteplus|vertexai|wavespeed|mediakit)(-|$)/
    ],
    ['a Router model id', /(^|-)(dreamina|interactions|recraftv\d)(-|$)/],
    ['Gemini as a stand-in for a Google brand', /(^|-)gemini-(?!omni-)/],
    ['a Router date stamp', /\d{6}/]
  ] as const)('never leaks %s', ([, forbidden]) => {
    expect(newSlugs.filter((slug) => forbidden.test(slug))).toEqual([])
  })

  it('claims no path another route already serves', () => {
    const patterns = sitePathPatterns()
    const collisions = newSlugs.flatMap((slug) =>
      patterns.filter((pattern) =>
        matchesRoute(pattern, `/hub/models/${slug}/`)
      )
    )
    expect(patterns).toContain('/p/supported-models/[slug]')
    expect(collisions).toEqual([])
  })
})

describe('compileModelUrlMap', () => {
  it.for([
    ['FLUX.1 Kontext Max Image Edit', 'flux-1-kontext-max-image-edit'],
    ['Seedance 2.5 Text-to-Video', 'seedance-2-5-text-to-video'],
    ['Runway Gen-4 Turbo Image-to-Video', 'runway-gen-4-turbo-image-to-video'],
    [' Bria RMBG 2.0 ', 'bria-rmbg-2-0']
  ] as const)('slugifies %s', ([name, slug]) => {
    expect(modelUrlSlug(name)).toBe(slug)
  })

  it('rejects two pages that would share a URL', () => {
    expect(() =>
      compileModelUrlMap(
        [
          { slug: 'a--veo-3--generate-videos', name: 'Veo 3 Text-to-Video' },
          { slug: 'b--veo-3--generate-videos', name: 'Veo 3: Text to Video' }
        ],
        new Map()
      )
    ).toThrow('both map to veo-3-text-to-video')
  })

  it('rejects an alias whose target page does not exist', () => {
    expect(() =>
      compileModelUrlMap(
        [{ slug: 'veo--veo-3--generate-videos', name: 'Veo 3 Text-to-Video' }],
        new Map([['veo--veo-3', 'veo--missing--generate-videos']])
      )
    ).toThrow('Alias veo--veo-3 targets unknown veo--missing--generate-videos')
  })
})
