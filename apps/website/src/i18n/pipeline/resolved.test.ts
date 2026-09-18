import { describe, expect, it } from 'vitest'

import { buildResolvedDictionary } from './resolved'
import type { SourceEntry } from './types'

const entries: SourceEntry[] = [
  { key: 'a', english: 'Alpha', approved: { 'zh-CN': '阿尔法' } },
  { key: 'b', english: 'Beta', approved: {} },
  { key: 'c', english: 'Gamma', approved: { ja: 'ガンマ' } }
]

describe('buildResolvedDictionary', () => {
  it('answers every key, so the browser never needs a fallback chain', () => {
    const dict = buildResolvedDictionary(entries, 'ja', { b: 'ベータ' })

    expect(dict).toEqual({ a: 'Alpha', b: 'ベータ', c: 'ガンマ' })
  })

  it('prefers approved over machine', () => {
    const dict = buildResolvedDictionary(entries, 'ja', { c: '機械翻訳' })

    expect(dict.c).toBe('ガンマ')
  })

  it('never lets the machine layer shadow English', () => {
    const dict = buildResolvedDictionary(entries, 'en', { a: 'Machine' })

    expect(dict.a).toBe('Alpha')
  })

  it('keeps an approved empty string rather than falling through to English', () => {
    // translations.ts blanks one half of a word-order fragment pair per
    // language. Treating '' as missing renders both halves of a heading.
    const blanked: SourceEntry[] = [
      { key: 'half', english: 'Build with', approved: { ja: '' } }
    ]

    expect(buildResolvedDictionary(blanked, 'ja', {}).half).toBe('')
  })

  it('preserves source order, which decides how legal sections are numbered', () => {
    const dict = buildResolvedDictionary(entries, 'en', {})

    expect(Object.keys(dict)).toEqual(['a', 'b', 'c'])
  })
})
