import { describe, expect, it } from 'vitest'

import publishedLocalModels from './__fixtures__/published-local-models.json' with { type: 'json' }
import { hubModelPath } from './hub-models'
import { localModelAliases, localModelPath, localModels } from './local-models'
import { models } from './models'
import { modelsUrlKind } from './models-url-registry'
import { partnerModelHubSlugs } from './partner-model-redirects'
import { siteRedirects, toVercelRedirects } from './redirects'

const OLD = '/p/supported-models'
const VERCEL_SOURCE_LIMIT = 2048

const vercelRedirects = toVercelRedirects(siteRedirects)

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Vercel's first-match lookup, for literal sources and one `:slug(a|b)` group. */
function resolve(path: string) {
  for (const { source, destination, permanent } of vercelRedirects) {
    const group = /^(.*):slug\(([^)]+)\)(.*)$/.exec(source)
    if (!group) {
      if (source === path) return { destination, permanent }
      continue
    }
    const [, before, slugs, after] = group
    const match = new RegExp(
      `^${escapeRegExp(before)}(${slugs})${escapeRegExp(after)}$`
    ).exec(path)
    if (match)
      return { destination: destination.replace(':slug', match[1]), permanent }
  }
  return undefined
}

const bothSlashForms = (path: string) => [path, `${path}/`]

const twinOf = (page: string) => `${page.replace(/\/$/, '')}.md`

const expected = new Map<string, string>([
  ...[OLD, `${OLD}/`].map((path) => [path, '/hub/models/local/'] as const),
  [`${OLD}.md`, '/hub/models/local.md'],
  [`${OLD}/llms.txt`, '/hub/models/local/llms.txt'],
  ...localModels.flatMap(({ slug }) => [
    ...bothSlashForms(`${OLD}/${slug}`).map(
      (path) => [path, localModelPath(slug)] as const
    ),
    [`${OLD}/${slug}.md`, twinOf(localModelPath(slug))] as const
  ]),
  ...localModelAliases.flatMap(({ slug, canonicalSlug = '' }) =>
    bothSlashForms(`${OLD}/${slug}`).map(
      (path) => [path, localModelPath(canonicalSlug)] as const
    )
  ),
  ...Object.entries(partnerModelHubSlugs).flatMap(([slug, hubSlug]) => {
    const page = hubSlug ? hubModelPath(hubSlug) : '/hub/models/'
    return [
      ...bothSlashForms(`${OLD}/${slug}`).map((path) => [path, page] as const),
      [`${OLD}/${slug}.md`, twinOf(page)] as const
    ]
  })
])

function landsOnBuiltPage(destination: string): boolean {
  if (destination === '/hub/models.md') return true
  if (destination.endsWith('.md')) {
    const page = destination.slice(0, -'.md'.length)
    return (
      modelsUrlKind(destination) === 'reserved' ||
      ['model', 'local'].includes(modelsUrlKind(page) ?? '')
    )
  }
  return ['local', 'model', 'hub', 'reserved'].includes(
    modelsUrlKind(destination) ?? ''
  )
}

describe('/p/supported-models redirects', () => {
  it('send every published address to its new page permanently, in one hop', () => {
    const wrong = [...expected].filter(([path, destination]) => {
      const hop = resolve(path)
      return (
        hop?.destination !== destination ||
        !hop.permanent ||
        resolve(destination) !== undefined ||
        !landsOnBuiltPage(destination)
      )
    })
    expect(wrong).toEqual([])
  })

  it.for([
    'stability-ai',
    'dreamshaper-8-pruned',
    'wan2-1-vae-fp32',
    'hailuo-minimax',
    'v1-5-pruned-emaonly-fp16',
    'ltxv-api',
    'minimax-h3-ref2va-pruned-int8_convrot',
    'not-a-model'
  ])('leave the retired %s a 404', (slug) => {
    for (const path of [
      ...bothSlashForms(`${OLD}/${slug}`),
      `${OLD}/${slug}.md`
    ])
      expect(resolve(path)).toBeUndefined()
  })

  it('send every partner page somewhere, and only partner pages', () => {
    expect(Object.keys(partnerModelHubSlugs).sort()).toEqual(
      models
        .filter((model) => model.directory === 'partner_nodes')
        .map(({ slug }) => slug)
        .sort()
    )
  })

  it('list every exact row before the file-page patterns', () => {
    const sources = vercelRedirects.map(({ source }) => source)
    const firstPattern = sources.findIndex((source) => source.includes(':'))
    const lastExact = sources.findLastIndex(
      (source) =>
        (source === OLD ||
          source.startsWith(`${OLD}/`) ||
          source.startsWith(`${OLD}.`)) &&
        !source.includes(':')
    )
    expect(firstPattern).toBeGreaterThan(lastExact)
  })

  it(`keep each source under Vercel's ${VERCEL_SOURCE_LIMIT}-character limit`, () => {
    expect(
      vercelRedirects.filter(
        ({ source }) => source.length > VERCEL_SOURCE_LIMIT
      )
    ).toEqual([])
  })

  it('keep every published file page, so a regenerated quantization group cannot drop one', () => {
    const built = new Set(localModels.map(({ slug }) => slug))
    expect(publishedLocalModels.filter((slug) => !built.has(slug))).toEqual([])
  })
})
