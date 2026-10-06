import { execFileSync } from 'node:child_process'
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
import { dirname, join, relative } from 'node:path'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import type { TranslationPipelineConfig } from './config'
import { translationTargets } from './config'
import type { LocaleObject } from './locale-tree'
import type { TranslateBatch, TranslationItem } from './translate'
import { updateLocales } from './update-locales'

const config = translationTargets.website
const manifestFile = '.source-manifest.json'

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function createTranslator(
  respond: (locale: string, item: TranslationItem) => string = (locale, item) =>
    `[${locale}] ${item.source}`,
  shouldFail: (locale: string, item: TranslationItem) => boolean = () => false
) {
  const requests: { locale: string; items: TranslationItem[] }[] = []
  const translate: TranslateBatch = async (locale, items) => {
    requests.push({ locale: locale.code, items })
    if (items.some((item) => shouldFail(locale.code, item)))
      throw new Error('provider unavailable')
    return Object.fromEntries(
      items.map((item) => [item.id, respond(locale.code, item)])
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

function createCatalogRepo(target: TranslationPipelineConfig = config) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'update-locales-')))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  const catalogs = join(root, target.output)

  function git(args: string[], input?: string): string {
    return execFileSync('git', args, { cwd: root, input, encoding: 'utf8' })
  }
  git(['init', '--quiet'])

  function absolute(file: string): string {
    return join(catalogs, file)
  }

  function writeText(file: string, content: string) {
    mkdirSync(dirname(absolute(file)), { recursive: true })
    writeFileSync(absolute(file), content)
  }

  function storeBlob(catalog: LocaleObject): string {
    return git(['hash-object', '-w', '--stdin'], json(catalog)).trim()
  }

  return {
    absolute,
    writeText,
    storeBlob,
    blobId(catalog: LocaleObject): string {
      return git(['hash-object', '--stdin'], json(catalog)).trim()
    },
    catBlob(id: string): string {
      return git(['cat-file', 'blob', id])
    },
    writeCatalog(file: string, catalog: LocaleObject) {
      writeText(file, json(catalog))
    },
    readCatalog(file: string): unknown {
      return JSON.parse(readFileSync(absolute(file), 'utf8'))
    },
    recordEnglish(
      files: Record<string, LocaleObject>,
      knownViolations?: Record<string, string[]>
    ) {
      writeText(
        manifestFile,
        json({
          version: 1,
          files: Object.fromEntries(
            Object.entries(files).map(([name, english]) => [
              name,
              storeBlob(english)
            ])
          ),
          knownViolations
        })
      )
    },
    readManifest(): unknown {
      return JSON.parse(readFileSync(absolute(manifestFile), 'utf8'))
    },
    readTree(): Record<string, string> {
      return Object.fromEntries(
        readdirSync(root, { recursive: true, encoding: 'utf8' })
          .filter(
            (file) =>
              !file.split('/').includes('.git') &&
              statSync(join(root, file)).isFile()
          )
          .sort()
          .map((file) => [
            relative(catalogs, join(root, file)),
            readFileSync(join(root, file), 'utf8')
          ])
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

describe('updateLocales generation', () => {
  it('regenerates changed app copy even when the locale was edited, recording the English blob', async () => {
    const repo = createCatalogRepo(translationTargets.app)
    const english = { greeting: 'Hi {n}', title: '<b>{n}</b> and {n}' }
    repo.recordEnglish({
      'main.json': { greeting: 'Hi {n}', title: 'Old {n}' }
    })
    repo.writeCatalog('en/main.json', english)
    repo.writeCatalog('zh/main.json', { greeting: '你好', title: '人工 {n}' })

    await repo.run(false, async () => ({ '1': '你好 {n}', '2': '生成 {n}' }))

    expect(repo.readCatalog('zh/main.json')).toEqual({
      greeting: '你好 {n}',
      title: '生成 {n}'
    })
    expect(repo.readManifest()).toEqual({
      version: 1,
      files: { 'main.json': repo.blobId(english) }
    })
  })

  it('writes only catalogs and a blob-ID manifest, then reruns without translating or rewriting', async () => {
    const repo = createCatalogRepo()
    const english = {
      hero: { title: 'Hello {name}', subtitle: 'Build anything' }
    }
    repo.writeText('en/main.json', JSON.stringify(english, null, 2))
    repo.writeCatalog('ja/removed.json', { gone: '消えた' })
    repo.writeText(manifestFile, json({ version: 1, files: {} }))

    expect((await repo.run(false, createTranslator().translate)).status).toBe(0)

    const tree = repo.readTree()
    expect({
      ...tree,
      [manifestFile]: JSON.parse(tree[manifestFile])
    }).toEqual({
      [manifestFile]: {
        version: 1,
        files: { 'main.json': repo.blobId(english) }
      },
      'en/main.json': json(english),
      'ja/main.json': json({
        hero: { subtitle: '[ja] Build anything', title: '[ja] Hello {name}' }
      }),
      'zh-CN/main.json': json({
        hero: {
          subtitle: '[zh-CN] Build anything',
          title: '[zh-CN] Hello {name}'
        }
      })
    })
    expect(repo.catBlob(repo.blobId(english))).toBe(json(english))

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
    repo.writeText(manifestFile, json({ version: 1, files: {} }))
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

  it('keeps unchanged-English edits, empty fragments, and new-key translations, but regenerates modified English', async () => {
    const repo = createCatalogRepo()
    repo.writeCatalog('en/main.json', { cta: { label: 'Start', note: 'Note' } })
    repo.writeText(manifestFile, json({ version: 1, files: {} }))
    await repo.run(false, createTranslator().translate)
    const english = {
      cta: { label: 'Start now', note: 'Note', prefix: 'Read the ', suffix: '' }
    }
    repo.writeCatalog('en/main.json', english)
    repo.writeCatalog('ja/main.json', {
      cta: {
        label: '今すぐ開始',
        note: '',
        prefix: '',
        suffix: 'をお読みください'
      }
    })
    const translator = createTranslator()

    expect((await repo.run(false, translator.translate)).status).toBe(0)

    expect(translator.sourcesByLocale()).toEqual({
      ja: ['Start now'],
      'zh-CN': ['Start now', 'Read the ']
    })
    expect(repo.readCatalog('ja/main.json')).toEqual({
      cta: {
        label: '[ja] Start now',
        note: '',
        prefix: '',
        suffix: 'をお読みください'
      }
    })
    expect(repo.readCatalog('zh-CN/main.json')).toEqual({
      cta: {
        label: '[zh-CN] Start now',
        note: '[zh-CN] Note',
        prefix: '[zh-CN] Read the ',
        suffix: ''
      }
    })
    expect(repo.readManifest()).toEqual({
      version: 1,
      files: { 'main.json': repo.blobId(english) }
    })

    const tree = repo.readTree()
    const rerun = createTranslator()
    await repo.run(false, rerun.translate)
    expect(rerun.requests).toEqual([])
    expect(repo.readTree()).toEqual(tree)
  })

  it.for([
    { name: 'duplicates the current English', copied: 'Terms v2', kept: false },
    {
      name: 'duplicates the previous English',
      copied: 'Terms v1',
      kept: false
    },
    { name: 'is a translation', copied: '規約', kept: true }
  ])(
    'never generates excluded legal copy; drops it for fallback when it $name',
    async ({ copied, kept }) => {
      const repo = createCatalogRepo()
      repo.recordEnglish({
        'main.json': { nav: { home: 'Home' }, tos: { title: 'Terms v1' } }
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

      expect(
        check.output.includes(
          'ja/main.json: 1 keys will be pruned or use English fallback'
        )
      ).toBe(!kept)
      expect(generation.status).toBe(0)
      expect(translator.requests).toEqual([])
      expect(repo.readCatalog('ja/main.json')).toEqual({
        nav: { home: 'ホーム' },
        ...(kept && { tos: { title: copied } })
      })
      expect(repo.readCatalog('zh-CN/main.json')).toEqual({
        nav: { home: '首页' }
      })
    }
  )

  it.for([
    {
      target: config,
      section: 'product',
      japanese: 'プラン {name}',
      expected: ''
    },
    {
      target: config,
      section: 'tos',
      japanese: '規約 {name}',
      expected: '規約 {name}'
    },
    {
      target: translationTargets.app,
      section: 'product',
      japanese: 'プラン {name}',
      expected: ''
    }
  ])(
    'writes $target.output $section copy whose English became empty without blocking',
    async ({ target, section, japanese, expected }) => {
      const repo = createCatalogRepo(target)
      repo.recordEnglish({
        'main.json': { [section]: { title: 'Title {name}' } }
      })
      repo.writeCatalog('en/main.json', { [section]: { title: '' } })
      repo.writeCatalog('ja/main.json', { [section]: { title: japanese } })
      repo.writeCatalog('zh-CN/main.json', {})
      const translator = createTranslator()

      expect((await repo.run(false, translator.translate)).status).toBe(0)

      expect(translator.requests).toEqual([])
      expect(repo.readCatalog('ja/main.json')).toEqual({
        [section]: { title: expected }
      })
    }
  )
})

describe('failure isolation', () => {
  function createTwoFileRepo() {
    const repo = createCatalogRepo()
    repo.recordEnglish(
      { 'a.json': { alpha: 'Alpha' }, 'b.json': { gamma: 'Gamma' } },
      { 'a.json': ['["alpha"]'] }
    )
    repo.writeCatalog('en/a.json', { alpha: 'Alpha', beta: 'Beta {name}' })
    repo.writeCatalog('ja/a.json', { alpha: 'アルファ' })
    repo.writeCatalog('zh-CN/a.json', { alpha: '阿尔法' })
    repo.writeCatalog('en/b.json', { delta: 'Delta', gamma: 'Gamma' })
    repo.writeCatalog('ja/b.json', { gamma: 'ガンマ' })
    repo.writeCatalog('zh-CN/b.json', { gamma: '伽马' })
    return repo
  }

  const aFiles = ['en/a.json', 'ja/a.json', 'zh-CN/a.json']

  it.for([
    {
      label: 'the provider fails',
      translator: () =>
        createTranslator(
          undefined,
          (locale, item) =>
            locale === 'zh-CN' && item.context.startsWith('a.json:')
        ),
      failures: ['zh-CN/a.json: provider unavailable']
    },
    {
      label: 'every attempt corrupts a protected token',
      translator: () =>
        createTranslator((locale, item) =>
          `[${locale}] ${item.source}`.replace(' {name}', '')
        ),
      failures: [
        'ja/a.json: Translation into ja failed for 1 strings after 3 attempts',
        'zh-CN/a.json: Translation into zh-CN failed for 1 strings after 3 attempts'
      ]
    }
  ])(
    'discards one entry file when $label while another file is written',
    async ({ translator, failures }) => {
      const repo = createTwoFileRepo()
      const before = repo.readTree()
      const recordedA = repo.blobId({ alpha: 'Alpha' })

      const error = await repo.run(false, translator().translate).then(
        () => undefined,
        (rejection: unknown) => String(rejection)
      )

      expect(error).toContain(`Translation failed for ${failures.length}`)
      expect(error?.split('\n')).toEqual(
        expect.arrayContaining(
          failures.map((failure) => expect.stringContaining(failure))
        )
      )
      const after = repo.readTree()
      expect(aFiles.map((file) => after[file])).toEqual(
        aFiles.map((file) => before[file])
      )
      expect(after['ja/b.json']).toBe(
        json({ delta: '[ja] Delta', gamma: 'ガンマ' })
      )
      expect(after['zh-CN/b.json']).toBe(
        json({ delta: '[zh-CN] Delta', gamma: '伽马' })
      )
      expect(repo.readManifest()).toEqual({
        version: 1,
        files: {
          'a.json': recordedA,
          'b.json': repo.blobId({ delta: 'Delta', gamma: 'Gamma' })
        },
        knownViolations: { 'a.json': ['["alpha"]'] }
      })
    }
  )
})

describe('edits during generation', () => {
  it.for([
    { file: 'en/main.json', edit: json({ title: 'Newer English' }) },
    { file: 'ja/main.json', edit: json({ title: '人が直した' }) },
    { file: manifestFile, edit: json({ version: 1, files: {} }) }
  ])(
    'refuses to write anything when $file changes during translation',
    async ({ file, edit }) => {
      const repo = createCatalogRepo()
      repo.recordEnglish({ 'main.json': { title: 'Hello' } })
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
})

describe('protected-token baselines', () => {
  const english = { farewell: 'Bye {name}', greeting: 'Hello {name}' }
  const japanese = { farewell: 'さようなら {name}', greeting: 'こんにちは' }
  const chinese = { farewell: '再见 {name}', greeting: '你好 {name}' }

  it('baselines array leaves without exempting object subtrees', async () => {
    const repo = createCatalogRepo()
    const source = { group: { title: 'Hi {name}' }, list: ['Bye {name}'] }
    repo.recordEnglish(
      { 'main.json': source },
      { 'main.json': ['["group"]', '["list"]'] }
    )
    repo.writeCatalog('en/main.json', source)
    repo.writeCatalog('ja/main.json', {
      group: { title: 'こんにちは' },
      list: ['さようなら']
    })

    const check = await repo.run(true)

    expect(check.status).toBe(1)
    expect(check.output).toContain('1 protected-token violations')
    expect(check.output).toContain('group.title: missing {name}')
  })

  it('keeps baselined paths that still violate and drops healed ones', async () => {
    const repo = createCatalogRepo()
    repo.recordEnglish(
      { 'main.json': english },
      { 'main.json': ['["farewell"]', '["greeting"]'] }
    )
    repo.writeCatalog('en/main.json', english)
    repo.writeCatalog('ja/main.json', japanese)
    repo.writeCatalog('zh-CN/main.json', chinese)
    const translator = createTranslator()

    const before = await repo.run(true)
    const generation = await repo.run(false, translator.translate)
    const after = await repo.run(true)

    expect(before.status).toBe(0)
    expect(generation.status).toBe(0)
    expect(translator.requests).toEqual([])
    expect(repo.readCatalog('ja/main.json')).toEqual(japanese)
    expect(repo.readManifest()).toEqual({
      version: 1,
      files: { 'main.json': repo.blobId(english) },
      knownViolations: { 'main.json': ['["greeting"]'] }
    })
    expect(after).toEqual({
      status: 0,
      output: expect.stringContaining('All locales are up to date')
    })
  })

  it('refuses retained copy with an unbaselined violation before calling the translator', async () => {
    const repo = createCatalogRepo()
    repo.recordEnglish(
      { 'main.json': english },
      { 'main.json': ['["greeting"]'] }
    )
    repo.writeCatalog('en/main.json', { ...english, cta: 'Start' })
    repo.writeCatalog('ja/main.json', {
      farewell: 'さようなら',
      greeting: 'こんにちは'
    })
    repo.writeCatalog('zh-CN/main.json', chinese)
    const before = repo.readTree()
    const translator = createTranslator()

    await expect(repo.run(false, translator.translate)).rejects.toThrow(
      'Fix retained copy before generation:\nja/main.json: farewell: missing {name}'
    )
    expect(translator.requests).toEqual([])
    expect(repo.readTree()).toEqual(before)
  })

  it('checks retained website copy with strict markup and current-locale link rules', async () => {
    const repo = createCatalogRepo()
    const source = {
      cta: 'See <a href="/pricing">pricing</a>',
      help: '<strong>Ask</strong> us'
    }
    repo.recordEnglish({ 'main.json': source })
    repo.writeCatalog('en/main.json', source)
    repo.writeCatalog('ja/main.json', {
      cta: '<a href="/ja/pricing">料金</a>を見る',
      help: '<strong>聞く'
    })
    repo.writeCatalog('zh-CN/main.json', {
      cta: '查看<a href="/pricing">价格</a>',
      help: '<strong>询问</strong>我们'
    })

    const check = await repo.run(true)

    expect(check.status).toBe(1)
    expect(check.output).toContain(
      'ja/main.json: help: missing </strong>\nja/main.json: help: malformed HTML nesting at <strong>\nPending: 0 translations, 0 prunable keys, 2 protected-token violations'
    )
  })
})

describe('unusable source metadata', () => {
  function seed(
    repo: ReturnType<typeof createCatalogRepo>,
    manifest: string | null = null
  ) {
    repo.writeCatalog('en/main.json', { greeting: 'Hi {name}' })
    repo.writeCatalog('ja/main.json', { greeting: 'こんにちは' })
    repo.writeCatalog('zh-CN/main.json', { greeting: '你好 {name}' })
    if (manifest !== null) repo.writeText(manifestFile, manifest)
  }

  it.for([
    {
      label: 'a fingerprint manifest',
      manifest: json({
        version: 3,
        files: { 'main.json': { source: {}, locales: {} } }
      }),
      message: 'Cannot load source manifest'
    },
    {
      label: 'a malformed blob ID',
      manifest: json({ version: 1, files: { 'main.json': 'not-a-blob' } }),
      message: 'Cannot load source manifest'
    },
    {
      label: 'corrupt JSON',
      manifest: '{"version": 1,',
      message: 'Cannot load source manifest'
    },
    { label: 'no manifest', manifest: null, message: 'Missing source manifest' }
  ])(
    'fails check and generation closed with $label',
    async ({ manifest, message }) => {
      const repo = createCatalogRepo()
      seed(repo, manifest)
      const before = repo.readTree()
      const translator = createTranslator()

      await expect(repo.run(false, translator.translate)).rejects.toThrow(
        message
      )
      await expect(repo.run(true)).rejects.toThrow(message)

      expect(translator.requests).toEqual([])
      expect(repo.readTree()).toEqual(before)
    }
  )

  it('warns and skips token auditing in check, but refuses generation, when the recorded blob is missing', async () => {
    const repo = createCatalogRepo()
    seed(repo)
    const missing = repo.blobId({ greeting: 'Hello {name}' })
    repo.writeText(
      manifestFile,
      json({ version: 1, files: { 'main.json': missing } })
    )
    const before = repo.readTree()
    const translator = createTranslator()

    const check = await repo.run(true)

    expect(check.status).toBe(0)
    expect(check.output).toContain(
      `WARNING: main.json: the recorded English source (${missing}) is unavailable`
    )
    expect(check.output).not.toContain('missing {name}')
    await expect(repo.run(false, translator.translate)).rejects.toThrow(
      `Cannot read the recorded English source for main.json (${missing})`
    )
    expect(translator.requests).toEqual([])
    expect(repo.readTree()).toEqual(before)
  })
})
