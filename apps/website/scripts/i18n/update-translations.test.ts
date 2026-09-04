import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { OutputLocale } from './config'
import { hashSource, loadManifest } from './manifest'
import type { TranslationEntry } from './source'
import {
  auditExisting,
  collectPending,
  runPipeline
} from './update-translations'

function entry(key: string, values: Record<string, string>): TranslationEntry {
  return { key, values, insertPoint: 0, replaceRanges: {} }
}

const locales: OutputLocale[] = [
  { code: 'zh-CN', name: 'Simplified Chinese' },
  { code: 'ja', name: 'Japanese' }
]

describe('collectPending', () => {
  it('flags an entirely missing locale value', () => {
    const entries = [entry('ui.copy', { en: 'Copy', 'zh-CN': '复制' })]

    const { pending } = collectPending(
      entries,
      { version: 1, entries: {} },
      locales
    )

    expect(pending).toEqual([
      {
        entry: entries[0],
        locale: locales[1],
        source: 'Copy',
        hasExisting: false
      }
    ])
  })

  it('bootstraps a baseline hash for a value the manifest has never seen, without queuing it', () => {
    const entries = [
      entry('ui.copy', { en: 'Copy', 'zh-CN': '复制', ja: 'コピー' })
    ]

    const { pending, manifestUpdates } = collectPending(
      entries,
      { version: 1, entries: {} },
      locales
    )

    expect(pending).toEqual([])
    expect(manifestUpdates.get('ui.copy')?.get('ja')).toBe(hashSource('Copy'))
    expect(manifestUpdates.get('ui.copy')?.get('zh-CN')).toBe(
      hashSource('Copy')
    )
  })

  it('leaves an up-to-date translation alone', () => {
    const entries = [
      entry('ui.copy', { en: 'Copy', 'zh-CN': '复制', ja: 'コピー' })
    ]
    const manifest = {
      version: 1 as const,
      entries: {
        'ui.copy': { ja: hashSource('Copy'), 'zh-CN': hashSource('Copy') }
      }
    }

    const { pending, manifestUpdates } = collectPending(
      entries,
      manifest,
      locales
    )

    expect(pending).toEqual([])
    expect(manifestUpdates.size).toBe(0)
  })

  it('re-queues every locale whose English source drifted since it was last generated', () => {
    const entries = [
      entry('ui.copy', { en: 'Copy now', 'zh-CN': '复制', ja: 'コピー' })
    ]
    const manifest = {
      version: 1 as const,
      entries: {
        'ui.copy': { ja: hashSource('Copy'), 'zh-CN': hashSource('Copy') }
      }
    }

    const { pending } = collectPending(entries, manifest, locales)

    expect(pending).toEqual([
      {
        entry: entries[0],
        locale: locales[0],
        source: 'Copy now',
        hasExisting: true
      },
      {
        entry: entries[0],
        locale: locales[1],
        source: 'Copy now',
        hasExisting: true
      }
    ])
  })
})

describe('runPipeline', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'i18n-run-pipeline-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('persists baseline hashes even when nothing is pending, so a later English edit is queued', async () => {
    const sourcePath = join(dir, 'translations.ts')
    const manifestPath = join(dir, '.translations-manifest.json')
    const fixture = `type Locale = 'en' | 'zh-CN' | 'ja'

const translations = {
  'ui.copy': {
    en: 'Copy',
    'zh-CN': '复制',
    ja: 'コピー'
  }
} as const satisfies Record<
  string,
  { en: string; 'zh-CN': string } & Partial<Record<Locale, string>>
>
`
    writeFileSync(sourcePath, fixture)

    await runPipeline([], { sourcePath, manifestPath })

    const manifest = loadManifest(manifestPath)
    expect(manifest.entries['ui.copy']).toEqual({
      'zh-CN': hashSource('Copy'),
      ja: hashSource('Copy')
    })
    expect(readFileSync(sourcePath, 'utf8')).toBe(fixture)
  })
})

describe('auditExisting', () => {
  it('reports a translation that dropped a protected tag', () => {
    const entries = [
      entry('ui.readMore', {
        en: 'Read <strong>more</strong>',
        ja: '続きを読む'
      })
    ]

    expect(auditExisting(entries)).toEqual([
      'ja/ui.readMore: missing </strong>, <strong>'
    ])
  })

  it('is silent when every existing translation preserves its tokens', () => {
    const entries = [entry('ui.copy', { en: 'Copy', ja: 'コピー' })]

    expect(auditExisting(entries)).toEqual([])
  })
})
