import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ModuleKind,
  flattenDiagnosticMessageText,
  transpileModule
} from 'typescript'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { modelAliasUrls, modelPageUrls } from '../src/config/model-urls'
import { astroRedirects } from '../src/config/redirects'
import {
  routerModelSlugAliases,
  workshopModels
} from '../src/config/workshop-browse-content'
import { modelsBuildRoutes } from '../src/integrations/workshop-release-gate'
import { PROVIDER_NAMES } from '../src/lib/workshop/provider-name'
import {
  MODEL_URL_SLUG,
  MODEL_URL_TABLE,
  MODEL_URLS_MODULE,
  compileModelUrlMap,
  modelUrlFlags,
  modelUrlSlug,
  renderModelUrlTable,
  renderModelUrlsModule
} from './generate-model-url-map'

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const newSlugs = modelPageUrls.map((page) => page.newSlug)

function sitePathPatterns(): string[] {
  const pagesDir = join(appDir, 'src/pages')
  const pages = readdirSync(pagesDir, { recursive: true, encoding: 'utf8' })
    .map((file) => file.replaceAll('\\', '/'))
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
    ...Object.keys(astroRedirects),
    ...vercel.redirects.map((redirect) => redirect.source)
  ]
}

function matchesRoute(pattern: string, path: string): boolean {
  const source = pattern
    .split(/(\[[^\]]+\]|:\w+\*?|\(\.\*\))/)
    .map((part) =>
      /^(\[\.\.\.|:\w+\*$|\(\.\*\)$)/.test(part)
        ? '.*'
        : /^(\[|:\w)/.test(part)
          ? '[^/]+'
          : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('')
  return new RegExp(`^${source}/?$`).test(path)
}

describe('model URL map', () => {
  it('matches the generator output (pnpm generate:model-url-map)', () => {
    const map = compileModelUrlMap(
      workshopModels,
      routerModelSlugAliases,
      modelPageUrls
    )
    expect(readFileSync(MODEL_URLS_MODULE, 'utf8')).toBe(
      renderModelUrlsModule(map)
    )
    expect(readFileSync(MODEL_URL_TABLE, 'utf8')).toBe(
      renderModelUrlTable(workshopModels, map)
    )
  })

  it('keeps every recorded slug when display names change', () => {
    const renamed = workshopModels.map((model) => ({
      ...model,
      name: `${model.name} Renamed`
    }))
    expect(
      compileModelUrlMap(renamed, routerModelSlugAliases, modelPageUrls)
    ).toEqual({ pages: modelPageUrls, aliases: modelAliasUrls })
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

  const renamedProviderIds = Object.entries(PROVIDER_NAMES)
    .filter(([id, name]) => modelUrlSlug(id) !== modelUrlSlug(name))
    .map(([id]) => (id === 'gemini' ? 'gemini(?!-omni-)' : modelUrlSlug(id)))

  it.for([
    [
      'a Router provider id',
      new RegExp(`(^|-)(${renamedProviderIds.join('|')})(-|$)`)
    ],
    ['a Router model id', /(^|-)(dreamina|interactions|recraftv\d)(-|$)/],
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

describe('modelUrlFlags', () => {
  const noTaskWords =
    'no task words in the name; the product name stands in for the task'

  it.for([
    [
      'an edit page whose Router model is overridden to generate-images',
      'openai--gpt-image-1--edit-images',
      'openai/gpt-image-1',
      'gpt-image-1-image-edit',
      []
    ],
    [
      'a task word that disagrees with the page use case',
      'openai--gpt-image-1--generate-images',
      'openai/gpt-image-1',
      'gpt-image-1-image-edit',
      ['name says "image-edit", page use case is generate-images']
    ],
    [
      'a digit inside a task word',
      'kling--avatar--animate-images',
      'kling/videos-avatar-image2video',
      'kling-avatar',
      [noTaskWords]
    ],
    [
      'a v-prefixed version',
      'bfl--erase-v1--edit-images',
      'bfl/erase-v1',
      'flux-tools-erase',
      [noTaskWords, 'no version in the name, Router id is bfl/erase-v1']
    ],
    [
      'an underscore version',
      'elevenlabs--eleven_v3--audio',
      'elevenlabs/eleven_v3',
      'elevenlabs-text-to-dialogue',
      ['no version in the name, Router id is elevenlabs/eleven_v3']
    ],
    [
      'a dotted version',
      'wan--happyhorse-text-to-video--generate-videos',
      'wan/happyhorse-1.1-t2v',
      'happyhorse-text-to-video',
      ['no version in the name, Router id is wan/happyhorse-1.1-t2v']
    ]
  ] as const)('flags %s', ([, slug, routerId, newSlug, flags]) => {
    expect(modelUrlFlags({ slug, routerId }, newSlug)).toEqual(flags)
  })
})

describe('renderModelUrlsModule', () => {
  it.for([
    'Veo 3\nText-to-Video',
    "Veo's 3 \\ Text\tto\rVideo",
    'Veo 3\u2028Text-to-Video',
    'Veo "3" Text-to-Video',
    'back\\"quote',
    "''\\\""
  ])('writes %j back as the same string', (name) => {
    const source = renderModelUrlsModule({
      pages: [{ oldSlug: 'veo--veo-3', newSlug: 'veo-3', name }],
      aliases: []
    })
    const { outputText, diagnostics } = transpileModule(source, {
      compilerOptions: { module: ModuleKind.CommonJS },
      reportDiagnostics: true
    })
    expect(
      diagnostics?.map((d) => flattenDiagnosticMessageText(d.messageText, ''))
    ).toEqual([])
    const module = { exports: { modelPageUrls: [] as { name: string }[] } }
    new Function('module', 'exports', outputText)(module, module.exports)
    expect(module.exports.modelPageUrls[0].name).toBe(name)
  })
})

describe('compileModelUrlMap', () => {
  it.for([
    ['FLUX.1 Kontext Max Image Edit', 'flux-1-kontext-max-image-edit'],
    ['Seedance 2.5 Text-to-Video', 'seedance-2-5-text-to-video'],
    ['Runway Gen-4 Turbo Image-to-Video', 'runway-gen-4-turbo-image-to-video'],
    ['Café Photo 2.0', 'cafe-photo-2-0'],
    [' Bria RMBG 2.0 ', 'bria-rmbg-2-0']
  ] as const)('slugifies %s', ([name, slug]) => {
    expect(modelUrlSlug(name)).toBe(slug)
  })

  it('keeps a published slug and its recorded name when the display name changes', () => {
    const models = [
      { slug: 'google--veo-3--generate-videos', name: 'Veo 3.1 Text-to-Video' },
      { slug: 'google--veo-4--generate-videos', name: 'Veo 4 Text-to-Video' }
    ]
    const frozen = [
      {
        oldSlug: 'google--veo-3--generate-videos',
        newSlug: 'veo-3-text-to-video',
        name: 'Veo 3 Text-to-Video'
      }
    ]
    expect(compileModelUrlMap(models, new Map(), frozen).pages).toEqual([
      ...frozen,
      {
        oldSlug: 'google--veo-4--generate-videos',
        newSlug: 'veo-4-text-to-video',
        name: 'Veo 4 Text-to-Video'
      }
    ])
  })

  it.for([
    [
      'flags a rename',
      'veo-3-text-to-video',
      'Veo 3.1 Text-to-Video',
      [
        '| `veo-3-text-to-video` | Veo 3.1 Text-to-Video | frozen at `veo-3-text-to-video` for "Veo 3 Text-to-Video", name now suggests `veo-3-1-text-to-video` |'
      ]
    ],
    [
      'ignores a deliberate slug edit',
      'google-veo-3-text-to-video',
      'Veo 3 Text-to-Video',
      []
    ],
    [
      'ignores a rename that keeps the same slug',
      'veo-3-text-to-video',
      'Veo 3: text to video',
      []
    ]
  ] as const)('%s', ([, newSlug, name, rows]) => {
    const model = {
      slug: 'google--veo-3--generate-videos',
      name,
      provider: 'Google',
      routerId: 'veo/veo-3.0-generate-001'
    }
    const map = compileModelUrlMap([model], new Map(), [
      { oldSlug: model.slug, newSlug, name: 'Veo 3 Text-to-Video' }
    ])
    const table = renderModelUrlTable([model], map)
    expect(table).toContain(`## Check these first (${rows.length})`)
    for (const row of rows) expect(table).toContain(row)
  })

  it('rejects a new page that takes a published slug', () => {
    expect(() =>
      compileModelUrlMap(
        [
          { slug: 'a--veo-3--generate-videos', name: 'Veo 3.1 Text-to-Video' },
          { slug: 'b--veo-3--generate-videos', name: 'Veo 3 Text-to-Video' }
        ],
        new Map(),
        [
          {
            oldSlug: 'a--veo-3--generate-videos',
            newSlug: 'veo-3-text-to-video',
            name: 'Veo 3 Text-to-Video'
          }
        ]
      )
    ).toThrow('both map to veo-3-text-to-video')
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

  it.for([
    ['a shared old slug', ['veo--veo-3', 'veo--veo-3'], 'share an old slug'],
    [
      'a quote in an old slug',
      ["veo--veo-3'", 'veo--veo-4'],
      'Invalid old slug'
    ]
  ] as const)('rejects %s', ([, [first, second], message]) => {
    expect(() =>
      compileModelUrlMap(
        [
          { slug: first, name: 'Veo 3 Text-to-Video' },
          { slug: second, name: 'Veo 4 Text-to-Video' }
        ],
        new Map()
      )
    ).toThrow(message)
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
