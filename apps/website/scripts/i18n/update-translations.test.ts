import { describe, expect, it } from 'vitest'

import type { OutputLocale } from './config'
import { hashSource } from './manifest'
import type { TranslationEntry } from './source'
import { auditExisting, collectPending } from './update-translations'

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
