import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import type { TranslationPipelineConfig } from './config'
import { translationTargets } from './config'
import type { LocaleObject } from './locale-tree'
import { fingerprintLocale, serializeLocale } from './locale-tree'
import type { FileSnapshot, SourceManifest } from './source-manifest'
import type { TranslateBatch, TranslationItem } from './translate'
import { updateLocales } from './update-locales'

const config = translationTargets.website

function createTranslator(
  shouldFail: (locale: string, item: TranslationItem) => boolean = () => false
) {
  const requests: { locale: string; items: TranslationItem[] }[] = []
  const translate: TranslateBatch = async (locale, items) => {
    requests.push({ locale: locale.code, items })
    if (items.some((item) => shouldFail(locale.code, item)))
      throw new Error('provider unavailable')
    return Object.fromEntries(
      items.map((item) => [item.id, `[${locale.code}] ${item.source}`])
    )
  }
  const sourcesByLocale = () =>
    Object.fromEntries(
      requests.map(({ locale, items }) => [
        locale,
        items.map(({ source }) => source)
      ])
    )
  return { translate, requests, sourcesByLocale }
}

function manifestBytes(files: SourceManifest['files']): string {
  return `${JSON.stringify({ version: 3, files }, null, 2)}\n`
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function snapshot({
  english,
  locales,
  reviewNeeded = {},
  knownViolations = []
}: {
  english: LocaleObject
  locales: Record<string, LocaleObject>
  reviewNeeded?: Record<string, string[][]>
  knownViolations?: FileSnapshot['knownViolations']
}): FileSnapshot {
  return {
    source: fingerprintLocale(english),
    locales: Object.fromEntries(
      Object.entries(locales).map(([code, catalog]) => [
        code,
        {
          fingerprints: fingerprintLocale(catalog),
          reviewNeeded: reviewNeeded[code] ?? []
        }
      ])
    ),
    knownViolations
  }
}

function createCatalogRepo(target: TranslationPipelineConfig = config) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'update-locales-')))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  const catalogs = join(root, target.output)

  function absolute(file: string): string {
    return join(catalogs, file)
  }

  function writeText(file: string, content: string) {
    mkdirSync(dirname(absolute(file)), { recursive: true })
    writeFileSync(absolute(file), content)
  }

  function writeCatalog(file: string, catalog: LocaleObject) {
    writeText(file, serializeLocale(catalog))
  }

  return {
    absolute,
    writeText,
    writeCatalog,
    readCatalog(file: string): unknown {
      return JSON.parse(readFileSync(absolute(file), 'utf8'))
    },
    writeManifest(files: SourceManifest['files']) {
      writeText('.source-manifest.json', manifestBytes(files))
    },
    readManifest(): SourceManifest {
      return JSON.parse(readFileSync(absolute('.source-manifest.json'), 'utf8'))
    },
    readTree(): Record<string, string> {
      return Object.fromEntries(
        readdirSync(catalogs, { recursive: true, encoding: 'utf8' })
          .filter((file) => statSync(absolute(file)).isFile())
          .sort()
          .map((file) => [file, readFileSync(absolute(file), 'utf8')])
      )
    },
    async run(check: boolean, translateBatch?: TranslateBatch) {
      const output: string[] = []
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        output.push(String(chunk))
        return true
      })
      try {
        const status = await updateLocales({
          repoRoot: root,
          config: target,
          check,
          translateBatch
        })
        return { status, output: output.join('') }
      } finally {
        vi.mocked(process.stdout.write).mockRestore()
      }
    }
  }
}

type CatalogRepo = ReturnType<typeof createCatalogRepo>

describe('updateLocales generation', () => {
  it('regenerates changed app copy with set-based token validation', async () => {
    const repo = createCatalogRepo(translationTargets.app)
    repo.writeManifest({
      'main.json': snapshot({
        english: { title: 'Old {n}' },
        locales: {}
      })
    })
    repo.writeCatalog('en/main.json', { title: '<b>{n}</b> and {n}' })
    repo.writeCatalog('zh/main.json', { title: '人工 {n}' })

    await repo.run(false, async () => ({ '1': '生成 {n}' }))

    expect(repo.readCatalog('zh/main.json')).toEqual({ title: '生成 {n}' })
    expect(repo.readManifest().files['main.json'].locales).toEqual({})
  })

  it.for([
    { file: 'en/main.json', edit: serializeLocale({ title: 'Newer English' }) },
    { file: 'ja/main.json', edit: serializeLocale({ title: '人が直した' }) },
    { file: '.source-manifest.json', edit: manifestBytes({}) }
  ])(
    'refuses publication when $file changes during translation',
    async ({ file, edit }) => {
      const repo = createCatalogRepo()
      repo.writeManifest({
        'main.json': snapshot({
          english: { title: 'Hello' },
          locales: { ja: { title: 'こんにちは' }, 'zh-CN': { title: '你好' } }
        })
      })
      repo.writeCatalog('en/main.json', { cta: 'Start', title: 'Hello' })
      repo.writeCatalog('ja/main.json', { title: 'こんにちは' })
      repo.writeCatalog('zh-CN/main.json', { title: '你好' })
      const before = repo.readTree()
      const translate: TranslateBatch = async (_locale, items) => {
        repo.writeText(file, edit)
        return Object.fromEntries(items.map((item) => [item.id, item.source]))
      }

      await expect(repo.run(false, translate)).rejects.toThrow(
        `${repo.absolute(file)} changed during translation`
      )

      expect(repo.readTree()).toEqual({ ...before, [file]: edit })
    }
  )

  it('publishes catalogs with a fingerprint manifest and no snapshot copies, then reruns without translating or rewriting', async () => {
    const repo = createCatalogRepo()
    repo.writeCatalog('en/main.json', {
      hero: { title: 'Hello {name}', subtitle: 'Build anything' }
    })
    repo.writeManifest({})
    const first = createTranslator()

    expect((await repo.run(false, first.translate)).status).toBe(0)

    const english = serializeLocale({
      hero: { title: 'Hello {name}', subtitle: 'Build anything' }
    })
    const japanese = serializeLocale({
      hero: { subtitle: '[ja] Build anything', title: '[ja] Hello {name}' }
    })
    const chinese = serializeLocale({
      hero: {
        subtitle: '[zh-CN] Build anything',
        title: '[zh-CN] Hello {name}'
      }
    })
    const tree = repo.readTree()
    expect({
      ...tree,
      '.source-manifest.json': JSON.parse(tree['.source-manifest.json'])
    }).toEqual({
      '.source-manifest.json': {
        version: 3,
        files: {
          'main.json': {
            source: {
              '["hero","subtitle"]': digest('Build anything'),
              '["hero","title"]': digest('Hello {name}')
            },
            locales: {
              ja: {
                fingerprints: {
                  '["hero","subtitle"]': digest('[ja] Build anything'),
                  '["hero","title"]': digest('[ja] Hello {name}')
                },
                reviewNeeded: []
              },
              'zh-CN': {
                fingerprints: {
                  '["hero","subtitle"]': digest('[zh-CN] Build anything'),
                  '["hero","title"]': digest('[zh-CN] Hello {name}')
                },
                reviewNeeded: []
              }
            },
            knownViolations: []
          }
        }
      },
      'en/main.json': english,
      'ja/main.json': japanese,
      'zh-CN/main.json': chinese
    })

    const second = createTranslator()
    expect((await repo.run(false, second.translate)).status).toBe(0)
    expect(second.requests).toEqual([])
    expect(repo.readTree()).toEqual(tree)
  })

  it('asks the translator to preserve HTML without inventing localized routes', async () => {
    const repo = createCatalogRepo()
    repo.writeCatalog('en/main.json', {
      cta: 'See <a href="/pricing">pricing</a>'
    })
    repo.writeManifest({})
    const translator = createTranslator()

    await repo.run(false, translator.translate)

    expect(translator.requests).toContainEqual({
      locale: 'ja',
      items: [
        expect.objectContaining({
          source: 'See <a href="/pricing">pricing</a>',
          preserve: ['</a>', '<a href="/pricing">']
        })
      ]
    })
  })

  it('keeps paired English and locale edits made after a generation, including new keys and empty fragments, and flags the changed English', async () => {
    const repo = createCatalogRepo()
    repo.writeCatalog('en/main.json', { cta: { label: 'Start' } })
    repo.writeManifest({})
    await repo.run(false, createTranslator().translate)
    repo.writeCatalog('en/main.json', {
      cta: { label: 'Start now', prefix: 'Read the ', suffix: '' }
    })
    const humanJapanese = {
      cta: { label: '今すぐ開始', prefix: '', suffix: 'をお読みください' }
    }
    repo.writeCatalog('ja/main.json', humanJapanese)
    const translator = createTranslator()

    expect((await repo.run(false, translator.translate)).status).toBe(0)

    expect(translator.sourcesByLocale()).toEqual({
      'zh-CN': ['Start now', 'Read the ']
    })
    expect(repo.readCatalog('ja/main.json')).toEqual(humanJapanese)
    expect(repo.readCatalog('zh-CN/main.json')).toEqual({
      cta: {
        label: '[zh-CN] Start now',
        prefix: '[zh-CN] Read the ',
        suffix: ''
      }
    })
    expect(repo.readManifest().files['main.json'].locales).toMatchObject({
      ja: { reviewNeeded: [['cta', 'label']] },
      'zh-CN': { reviewNeeded: [] }
    })
  })

  it.for([
    { name: 'the current English', copied: 'Terms v2' },
    { name: 'the previous English', copied: 'Terms v1' }
  ])(
    'drops excluded legal copy that duplicates $name so the site falls back',
    async ({ copied }) => {
      const repo = createCatalogRepo()
      repo.writeManifest({
        'main.json': snapshot({
          english: { nav: { home: 'Home' }, tos: { title: 'Terms v1' } },
          locales: {
            ja: { nav: { home: 'ホーム' }, tos: { title: copied } },
            'zh-CN': { nav: { home: '首页' } }
          }
        })
      })
      repo.writeCatalog('en/main.json', {
        nav: { home: 'Home' },
        tos: { title: 'Terms v2' }
      })
      repo.writeCatalog('ja/main.json', {
        nav: { home: 'ホーム' },
        tos: { title: copied }
      })
      repo.writeCatalog('zh-CN/main.json', { nav: { home: '首页' } })
      const translator = createTranslator()

      const check = await repo.run(true)
      const generation = await repo.run(false, translator.translate)

      expect(check.output).toContain(
        'ja/main.json: 1 keys will be pruned or use English fallback'
      )
      expect(generation.status).toBe(0)
      expect(translator.requests).toEqual([])
      expect(repo.readCatalog('ja/main.json')).toEqual({
        nav: { home: 'ホーム' }
      })
    }
  )

  it.for([
    {
      section: 'product',
      japanese: 'プラン {name}',
      expected: '',
      reviewNeeded: []
    },
    {
      section: 'tos',
      japanese: '規約 {name}',
      expected: '規約 {name}',
      reviewNeeded: [['tos', 'title']]
    }
  ])(
    'publishes $section copy whose English became empty without blocking',
    async ({ section, japanese, expected, reviewNeeded }) => {
      const repo = createCatalogRepo()
      const translation = { [section]: { title: japanese } }
      repo.writeManifest({
        'main.json': snapshot({
          english: { [section]: { title: 'Title {name}' } },
          locales: { ja: translation, 'zh-CN': {} }
        })
      })
      repo.writeCatalog('en/main.json', { [section]: { title: '' } })
      repo.writeCatalog('ja/main.json', translation)
      repo.writeCatalog('zh-CN/main.json', {})
      const translator = createTranslator()

      expect((await repo.run(false, translator.translate)).status).toBe(0)

      expect(translator.requests).toEqual([])
      expect(repo.readCatalog('ja/main.json')).toEqual({
        [section]: { title: expected }
      })
      expect(
        repo.readManifest().files['main.json'].locales.ja.reviewNeeded
      ).toEqual(reviewNeeded)
    }
  )

  it('keeps every output and the manifest entry of an entry file with a failed locale while other files publish', async () => {
    const repo = createCatalogRepo()
    repo.writeManifest({
      'a.json': snapshot({
        english: { alpha: 'Alpha' },
        locales: { ja: { alpha: 'アルファ' }, 'zh-CN': { alpha: '阿尔法' } }
      }),
      'b.json': snapshot({
        english: { gamma: 'Gamma' },
        locales: { ja: { gamma: 'ガンマ' }, 'zh-CN': { gamma: '伽马' } }
      })
    })
    repo.writeCatalog('en/a.json', { alpha: 'Alpha', beta: 'Beta' })
    repo.writeCatalog('ja/a.json', { alpha: 'アルファ' })
    repo.writeCatalog('zh-CN/a.json', { alpha: '阿尔法' })
    repo.writeCatalog('en/b.json', { delta: 'Delta', gamma: 'Gamma' })
    repo.writeCatalog('ja/b.json', { gamma: 'ガンマ' })
    repo.writeCatalog('zh-CN/b.json', { gamma: '伽马' })
    const filesOf = (tree: Record<string, string>, filename: string) =>
      Object.fromEntries(
        Object.entries(tree).filter(([file]) => file.endsWith(filename))
      )
    const before = repo.readTree()
    const snapshotA = repo.readManifest().files['a.json']
    const translator = createTranslator(
      (locale, item) => locale === 'zh-CN' && item.context.startsWith('a.json:')
    )

    await expect(repo.run(false, translator.translate)).rejects.toThrow(
      'Translation failed for 1 locale files:\nzh-CN/a.json: provider unavailable'
    )

    const after = repo.readTree()
    expect(filesOf(after, '/a.json')).toEqual(filesOf(before, '/a.json'))
    expect(repo.readManifest().files['a.json']).toEqual(snapshotA)
    expect(after['ja/b.json']).toBe(
      serializeLocale({ delta: '[ja] Delta', gamma: 'ガンマ' })
    )
    expect(repo.readManifest().files['b.json']).toEqual({
      source: { '["delta"]': digest('Delta'), '["gamma"]': digest('Gamma') },
      locales: {
        ja: {
          fingerprints: {
            '["delta"]': digest('[ja] Delta'),
            '["gamma"]': digest('ガンマ')
          },
          reviewNeeded: []
        },
        'zh-CN': {
          fingerprints: {
            '["delta"]': digest('[zh-CN] Delta'),
            '["gamma"]': digest('伽马')
          },
          reviewNeeded: []
        }
      },
      knownViolations: []
    })
  })
})

describe('review flags', () => {
  it.for([
    {
      section: 'tos',
      previous: '規約 v1',
      retained: '規約 v1',
      resolution: 'the translation is edited',
      resolve: (repo: CatalogRepo) =>
        repo.writeCatalog('ja/main.json', { tos: { title: '規約 v2' } })
    },
    {
      section: 'product',
      previous: 'プラン v1',
      retained: 'プラン v2 (人が直した)',
      resolution: 'the reviewNeeded entry is removed',
      resolve: (repo: CatalogRepo) => {
        const { files } = repo.readManifest()
        files['main.json'].locales.ja.reviewNeeded = []
        repo.writeManifest(files)
      }
    }
  ])(
    'keeps retained $section copy flagged across generations until $resolution',
    async ({ section, previous, retained, resolve }) => {
      const repo = createCatalogRepo()
      repo.writeManifest({
        'main.json': snapshot({
          english: { [section]: { title: 'Terms v1' } },
          locales: { ja: { [section]: { title: previous } }, 'zh-CN': {} }
        })
      })
      repo.writeCatalog('en/main.json', { [section]: { title: 'Terms v2' } })
      repo.writeCatalog('ja/main.json', { [section]: { title: retained } })
      repo.writeCatalog('zh-CN/main.json', {})

      await repo.run(false, createTranslator().translate)
      await repo.run(false, createTranslator().translate)
      const generated = repo.readTree()
      const flagged = await repo.run(true)
      const checked = repo.readTree()
      const manifest = repo.readManifest()
      resolve(repo)
      const resolved = await repo.run(true)

      expect(checked).toEqual(generated)
      expect(JSON.parse(generated['ja/main.json'])).toEqual({
        [section]: { title: retained }
      })
      expect(manifest.files['main.json'].locales.ja.reviewNeeded).toEqual([
        [section, 'title']
      ])
      expect(flagged.output).toContain(
        `REVIEW NEEDED: ja/main.json: ${section}.title`
      )
      expect(resolved.output).not.toContain('REVIEW NEEDED')
      expect(resolved.output).toContain('All locales are up to date')
    }
  )
})

describe('protected-token baselines', () => {
  const english = { farewell: 'Bye {name}', greeting: 'Hello {name}' }
  const knownViolations = [
    {
      locale: 'ja',
      path: ['greeting'],
      code: 'missing-token' as const,
      token: '{name}'
    },
    {
      locale: 'zh-CN',
      path: ['farewell'],
      code: 'missing-token' as const,
      token: '{name}'
    }
  ]
  const japanese = { farewell: 'さようなら {name}', greeting: 'こんにちは' }
  const chinese = { farewell: '再见 {name}', greeting: '你好 {name}' }

  it.for([
    { section: 'tos', remaining: 1 },
    { section: 'product', remaining: 0 }
  ])(
    'defers $section exceptions until their source changes are processed',
    async ({ section, remaining }) => {
      const repo = createCatalogRepo()
      const baseline: FileSnapshot['knownViolations'] = [
        {
          locale: 'ja',
          path: [section, 'title'],
          code: 'missing-token',
          token: '{name}'
        }
      ]
      const translation = { [section]: { title: 'こんにちは' } }
      repo.writeManifest({
        'main.json': snapshot({
          english: { [section]: { title: 'Hello {name}' } },
          locales: { ja: translation, 'zh-CN': {} },
          knownViolations: baseline
        })
      })
      repo.writeCatalog('en/main.json', {
        [section]: { title: 'Welcome {name}' }
      })
      repo.writeCatalog('ja/main.json', translation)
      repo.writeCatalog('zh-CN/main.json', {})

      const before = await repo.run(true)
      await repo.run(false, createTranslator().translate)
      const after = await repo.run(true)

      expect(before.output).not.toContain('STALE BASELINE')
      expect(after.output).not.toContain('STALE BASELINE')
      expect(repo.readManifest().files['main.json'].knownViolations).toEqual(
        baseline.slice(0, remaining)
      )
    }
  )

  it("keeps both locales' baselines when each still violates", async () => {
    const repo = createCatalogRepo()
    const zh = { farewell: '再见', greeting: '你好 {name}' }
    repo.writeManifest({
      'main.json': snapshot({
        english,
        locales: { ja: japanese, 'zh-CN': zh },
        knownViolations
      })
    })
    repo.writeCatalog('en/main.json', english)
    repo.writeCatalog('ja/main.json', japanese)
    repo.writeCatalog('zh-CN/main.json', zh)

    await repo.run(false, createTranslator().translate)

    expect(repo.readManifest().files['main.json'].knownViolations).toEqual([
      knownViolations[1],
      knownViolations[0]
    ])
    expect((await repo.run(true)).status).toBe(0)
  })

  it('retains the exact per-locale baseline and drops the healed entry', async () => {
    const repo = createCatalogRepo()
    repo.writeManifest({
      'main.json': snapshot({
        english,
        locales: { ja: japanese, 'zh-CN': chinese },
        knownViolations
      })
    })
    repo.writeCatalog('en/main.json', english)
    repo.writeCatalog('ja/main.json', japanese)
    repo.writeCatalog('zh-CN/main.json', chinese)

    const before = await repo.run(true)
    const generation = await repo.run(false, createTranslator().translate)
    const after = await repo.run(true)

    expect(before.output).toContain(
      'STALE BASELINE: zh-CN/main.json: farewell: missing {name}'
    )
    expect(before.output).not.toContain('All locales are up to date')
    expect(generation.status).toBe(0)
    expect(repo.readCatalog('ja/main.json')).toEqual(japanese)
    expect(repo.readManifest().files['main.json'].knownViolations).toEqual([
      knownViolations[0]
    ])
    expect(after).toEqual({
      status: 0,
      output: expect.stringContaining('All locales are up to date')
    })
  })

  it.for([
    {
      name: 'a second violation in the baselined locale',
      ja: { farewell: 'さようなら', greeting: 'こんにちは' },
      zh: chinese,
      diagnostic: 'ja/main.json: farewell: missing {name}'
    },
    {
      name: 'the baselined violation in another locale',
      ja: japanese,
      zh: { farewell: '再见 {name}', greeting: '你好' },
      diagnostic: 'zh-CN/main.json: greeting: missing {name}'
    }
  ])(
    'refuses $name before calling the translator',
    async ({ ja, zh, diagnostic }) => {
      const repo = createCatalogRepo()
      repo.writeManifest({
        'main.json': snapshot({
          english,
          locales: { ja: japanese, 'zh-CN': chinese },
          knownViolations
        })
      })
      repo.writeCatalog('en/main.json', { ...english, cta: 'Start' })
      repo.writeCatalog('ja/main.json', ja)
      repo.writeCatalog('zh-CN/main.json', zh)
      const before = repo.readTree()
      const translator = createTranslator()

      await expect(repo.run(false, translator.translate)).rejects.toThrow(
        `Fix retained copy before generation:\n${diagnostic}`
      )
      expect(translator.requests).toEqual([])
      expect(repo.readTree()).toEqual(before)
    }
  )

  it('checks retained website copy with strict markup and current-locale link rules', async () => {
    const repo = createCatalogRepo()
    const source = {
      cta: 'See <a href="/pricing">pricing</a>',
      help: '<strong>Ask</strong> us'
    }
    const ja = {
      cta: '<a href="/ja/pricing">料金</a>を見る',
      help: '<strong>聞く'
    }
    const zh = {
      cta: '查看<a href="/pricing">价格</a>',
      help: '<strong>询问</strong>我们'
    }
    repo.writeManifest({
      'main.json': snapshot({
        english: source,
        locales: { ja, 'zh-CN': zh }
      })
    })
    repo.writeCatalog('en/main.json', source)
    repo.writeCatalog('ja/main.json', ja)
    repo.writeCatalog('zh-CN/main.json', zh)

    const check = await repo.run(true)

    expect(check.status).toBe(1)
    expect(check.output).toContain(
      'ja/main.json: help: missing </strong>\nja/main.json: help: malformed HTML nesting at <strong>\nPending: 0 translations, 0 prunable keys, 2 protected-token violations'
    )
  })
})

describe('missing or malformed fingerprint metadata', () => {
  const valid = snapshot({
    english: { greeting: 'Hello {name}' },
    locales: {
      ja: { greeting: 'こんにちは {name}' },
      'zh-CN': { greeting: '你好 {name}' }
    }
  })

  it.for([
    {
      label: 'source fingerprints are missing',
      file: { ...valid, source: undefined }
    },
    {
      label: 'locale fingerprints are missing',
      file: {
        ...valid,
        locales: { ...valid.locales, ja: { reviewNeeded: [] } }
      }
    },
    {
      label: 'a source fingerprint is malformed',
      file: { ...valid, source: { '["greeting"]': 'not-a-sha256-digest' } }
    }
  ])('fails check and generation closed when $label', async ({ file }) => {
    const repo = createCatalogRepo()
    repo.writeText(
      '.source-manifest.json',
      JSON.stringify({ version: 3, files: { 'main.json': file } })
    )
    repo.writeCatalog('en/main.json', { greeting: 'Hi {name}' })
    repo.writeCatalog('ja/main.json', { greeting: 'こんにちは {name}' })
    repo.writeCatalog('zh-CN/main.json', { greeting: '你好 {name}' })
    const before = repo.readTree()
    const translator = createTranslator()
    const message = `Cannot load source manifest ${repo.absolute('.source-manifest.json')}`

    await expect(repo.run(false, translator.translate)).rejects.toThrow(message)
    await expect(repo.run(true)).rejects.toThrow(message)

    expect(translator.requests).toEqual([])
    expect(repo.readTree()).toEqual(before)
  })
})

describe('interrupted publication', () => {
  const oldEnglish = { greeting: 'Hello' }
  const newEnglish = { farewell: 'Bye', greeting: 'Hello' }
  const oldJapanese = { greeting: 'こんにちは' }
  const newJapanese = { farewell: 'さようなら', greeting: 'こんにちは' }
  const oldChinese = { greeting: '你好' }
  const newChinese = { farewell: '再见', greeting: '你好' }

  function createInterruptedPublication() {
    const repo = createCatalogRepo()
    repo.writeManifest({
      'main.json': snapshot({
        english: oldEnglish,
        locales: { ja: oldJapanese }
      })
    })
    const oldManifest = repo.readTree()['.source-manifest.json']
    const journal = [
      { path: 'ja/main.json', old: oldJapanese, new: newJapanese },
      { path: 'zh-CN/main.json', old: oldChinese, new: newChinese }
    ].map((entry) => ({
      path: entry.path,
      old: serializeLocale(entry.old),
      new: serializeLocale(entry.new)
    }))
    repo.writeText(
      '.locale-publication.json',
      JSON.stringify({
        version: 1,
        files: [
          ...journal,
          {
            path: '.source-manifest.json',
            old: oldManifest,
            new: manifestBytes({
              'main.json': snapshot({
                english: newEnglish,
                locales: { ja: newJapanese, 'zh-CN': newChinese }
              })
            })
          }
        ]
      })
    )
    repo.writeCatalog('ja/main.json', newJapanese)
    repo.writeCatalog('zh-CN/main.json', oldChinese)
    repo.writeCatalog('en/main.json', {
      farewell: 'Bye',
      greeting: 'Hello there'
    })
    return repo
  }

  it('refuses to check without touching any file', async () => {
    const repo = createInterruptedPublication()
    const before = repo.readTree()

    await expect(repo.run(true)).rejects.toThrow(
      'Incomplete locale publication'
    )
    expect(repo.readTree()).toEqual(before)
  })

  it('completes the publication, then translates only English changed since it', async () => {
    const repo = createInterruptedPublication()
    const translator = createTranslator()

    expect((await repo.run(false, translator.translate)).status).toBe(0)

    expect(translator.sourcesByLocale()).toEqual({
      ja: ['Hello there'],
      'zh-CN': ['Hello there']
    })
    const english = serializeLocale({
      farewell: 'Bye',
      greeting: 'Hello there'
    })
    const japanese = serializeLocale({
      farewell: 'さようなら',
      greeting: '[ja] Hello there'
    })
    const chinese = serializeLocale({
      farewell: '再见',
      greeting: '[zh-CN] Hello there'
    })
    const tree = repo.readTree()
    expect({
      ...tree,
      '.source-manifest.json': JSON.parse(tree['.source-manifest.json'])
    }).toEqual({
      '.source-manifest.json': {
        version: 3,
        files: {
          'main.json': {
            source: {
              '["farewell"]': digest('Bye'),
              '["greeting"]': digest('Hello there')
            },
            locales: {
              ja: {
                fingerprints: {
                  '["farewell"]': digest('さようなら'),
                  '["greeting"]': digest('[ja] Hello there')
                },
                reviewNeeded: []
              },
              'zh-CN': {
                fingerprints: {
                  '["farewell"]': digest('再见'),
                  '["greeting"]': digest('[zh-CN] Hello there')
                },
                reviewNeeded: []
              }
            },
            knownViolations: []
          }
        }
      },
      'en/main.json': english,
      'ja/main.json': japanese,
      'zh-CN/main.json': chinese
    })
  })
})
