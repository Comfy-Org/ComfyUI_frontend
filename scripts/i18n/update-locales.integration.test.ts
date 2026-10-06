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

import { translationTargets } from './config'
import type { LocaleObject } from './locale-tree'
import { serializeLocale } from './locale-tree'
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
  return `${JSON.stringify({ version: 2, files }, null, 2)}\n`
}

const unflaggedManifest = manifestBytes({
  'main.json': {
    locales: { 'zh-CN': { reviewNeeded: [] }, ja: { reviewNeeded: [] } },
    knownViolations: []
  }
})

function createCatalogRepo() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'update-locales-')))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  const catalogs = join(root, config.output)

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
    remove(file: string) {
      rmSync(absolute(file))
    },
    readCatalog(file: string): unknown {
      return JSON.parse(readFileSync(absolute(file), 'utf8'))
    },
    record({
      filename = 'main.json',
      english,
      locales,
      reviewNeeded = {},
      knownViolations = []
    }: {
      filename?: string
      english: LocaleObject
      locales: Record<string, LocaleObject>
      reviewNeeded?: Record<string, string[][]>
      knownViolations?: FileSnapshot['knownViolations']
    }): FileSnapshot {
      writeCatalog(`.published/en/${filename}`, english)
      for (const [code, catalog] of Object.entries(locales))
        writeCatalog(`.published/${code}/${filename}`, catalog)
      return {
        locales: Object.fromEntries(
          Object.keys(locales).map((code) => [
            code,
            { reviewNeeded: reviewNeeded[code] ?? [] }
          ])
        ),
        knownViolations
      }
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
          config,
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
  it.for([
    { file: 'en/main.json', edit: serializeLocale({ title: 'Newer English' }) },
    { file: 'ja/main.json', edit: serializeLocale({ title: '人が直した' }) },
    {
      file: '.published/ja/main.json',
      edit: serializeLocale({ title: '手で戻した' })
    },
    { file: '.source-manifest.json', edit: manifestBytes({}) }
  ])(
    'refuses publication when $file changes during translation',
    async ({ file, edit }) => {
      const repo = createCatalogRepo()
      repo.writeManifest({
        'main.json': repo.record({
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

  it('publishes source and locale snapshot files, then reruns without translating or rewriting', async () => {
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
    expect(tree).toEqual({
      '.published/en/main.json': english,
      '.published/ja/main.json': japanese,
      '.published/zh-CN/main.json': chinese,
      '.source-manifest.json': unflaggedManifest,
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

  it('keeps paired English and locale edits, including new keys and empty fragments, and flags the changed English', async () => {
    const repo = createCatalogRepo()
    const previousEnglish = { cta: { label: 'Start' } }
    repo.writeManifest({
      'main.json': repo.record({
        english: previousEnglish,
        locales: {
          ja: { cta: { label: '開始' } },
          'zh-CN': { cta: { label: '开始' } }
        }
      })
    })
    repo.writeCatalog('en/main.json', {
      cta: { label: 'Start now', prefix: 'Read the ', suffix: '' }
    })
    const humanJapanese = {
      cta: { label: '今すぐ開始', prefix: '', suffix: 'をお読みください' }
    }
    repo.writeCatalog('ja/main.json', humanJapanese)
    repo.writeCatalog('zh-CN/main.json', { cta: { label: '开始' } })
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
    expect(repo.readManifest().files['main.json'].locales).toEqual({
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
        'main.json': repo.record({
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
        'main.json': repo.record({
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

  it('keeps every output and snapshot of an entry file with a failed locale while other files publish', async () => {
    const repo = createCatalogRepo()
    repo.writeManifest({
      'a.json': repo.record({
        filename: 'a.json',
        english: { alpha: 'Alpha' },
        locales: { ja: { alpha: 'アルファ' }, 'zh-CN': { alpha: '阿尔法' } }
      }),
      'b.json': repo.record({
        filename: 'b.json',
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
    const japaneseB = serializeLocale({ delta: '[ja] Delta', gamma: 'ガンマ' })
    expect({
      'ja/b.json': after['ja/b.json'],
      '.published/en/b.json': after['.published/en/b.json'],
      '.published/ja/b.json': after['.published/ja/b.json']
    }).toEqual({
      'ja/b.json': japaneseB,
      '.published/en/b.json': after['en/b.json'],
      '.published/ja/b.json': japaneseB
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
        'main.json': repo.record({
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
        'main.json': repo.record({
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
      'main.json': repo.record({
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
      'main.json': repo.record({
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
        'main.json': repo.record({
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
      'main.json': repo.record({
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

describe('unavailable published snapshots', () => {
  it.for(['.published/en/main.json', '.published/ja/main.json'])(
    'fails check and generation closed when %s is missing',
    async (snapshot) => {
      const repo = createCatalogRepo()
      repo.writeManifest({
        'main.json': repo.record({
          english: { greeting: 'Hello {name}' },
          locales: {
            ja: { greeting: 'こんにちは {name}' },
            'zh-CN': { greeting: '你好 {name}' }
          }
        })
      })
      repo.remove(snapshot)
      repo.writeCatalog('en/main.json', { greeting: 'Hi {name}' })
      repo.writeCatalog('ja/main.json', { greeting: 'こんにちは {name}' })
      repo.writeCatalog('zh-CN/main.json', { greeting: '你好 {name}' })
      const before = repo.readTree()
      const translator = createTranslator()
      const message = `Missing catalog ${repo.absolute(snapshot)}. Restore it from version control.`

      await expect(repo.run(false, translator.translate)).rejects.toThrow(
        message
      )
      await expect(repo.run(true)).rejects.toThrow(message)

      expect(translator.requests).toEqual([])
      expect(repo.readTree()).toEqual(before)
    }
  )
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
      'main.json': repo.record({
        english: oldEnglish,
        locales: { ja: oldJapanese }
      })
    })
    const oldManifest = repo.readTree()['.source-manifest.json']
    const journal = [
      { path: 'ja/main.json', old: oldJapanese, new: newJapanese },
      { path: 'zh-CN/main.json', old: oldChinese, new: newChinese },
      { path: '.published/en/main.json', old: oldEnglish, new: newEnglish },
      { path: '.published/ja/main.json', old: oldJapanese, new: newJapanese },
      { path: '.published/zh-CN/main.json', old: null, new: newChinese }
    ].map((entry) => ({
      path: entry.path,
      old: entry.old && serializeLocale(entry.old),
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
            new: unflaggedManifest
          }
        ]
      })
    )
    repo.writeCatalog('ja/main.json', newJapanese)
    repo.writeCatalog('zh-CN/main.json', oldChinese)
    repo.writeCatalog('.published/en/main.json', newEnglish)
    repo.writeCatalog('.published/ja/main.json', newJapanese)
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
    expect(repo.readTree()).toEqual({
      '.published/en/main.json': english,
      '.published/ja/main.json': japanese,
      '.published/zh-CN/main.json': chinese,
      '.source-manifest.json': unflaggedManifest,
      'en/main.json': english,
      'ja/main.json': japanese,
      'zh-CN/main.json': chinese
    })
  })
})
