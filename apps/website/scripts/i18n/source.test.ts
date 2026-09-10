import { describe, expect, it } from 'vitest'

import {
  applyEdits,
  insertLocaleEdit,
  parseTranslationsText,
  replaceLocaleEdit
} from './source'

const fixture = `type Locale = 'en' | 'zh-CN' | 'ja'

const translations = {
  'ui.copy': {
    en: 'Copy',
    'zh-CN': '复制'
  },
  'ui.readMore': {
    en: 'Read more',
    'zh-CN': '展开',
    ja: '詳しく見る'
  }
} as const satisfies Record<
  string,
  { en: string; 'zh-CN': string } & Partial<Record<Locale, string>>
>
`

describe('parseTranslationsText', () => {
  it('extracts every key and its present locale values', () => {
    const { entries } = parseTranslationsText(fixture, 'fixture.ts')
    expect(entries.map((entry) => entry.key)).toEqual([
      'ui.copy',
      'ui.readMore'
    ])
    expect(entries[0].values).toEqual({ en: 'Copy', 'zh-CN': '复制' })
    expect(entries[1].values).toEqual({
      en: 'Read more',
      'zh-CN': '展开',
      ja: '詳しく見る'
    })
  })

  it('throws when the source has no `const translations = {...}` declaration', () => {
    expect(() =>
      parseTranslationsText('export const other = {}', 'fixture.ts')
    ).toThrow(/could not find/)
  })

  it('throws when a locale value is not a string literal', () => {
    expect(() =>
      parseTranslationsText(
        `const translations = { 'ui.copy': { en: 1 } }`,
        'fixture.ts'
      )
    ).toThrow('translations["ui.copy"].en is not a string')
  })
})

describe('insertLocaleEdit', () => {
  it('adds a missing locale without disturbing sibling entries', () => {
    const { text, entries } = parseTranslationsText(fixture, 'fixture.ts')
    const result = applyEdits(text, [
      insertLocaleEdit(entries[0], 'ja', 'コピー')
    ])
    const reparsed = parseTranslationsText(result, 'fixture.ts')
    expect(reparsed.entries[0].values).toEqual({
      en: 'Copy',
      'zh-CN': '复制',
      ja: 'コピー'
    })
    expect(reparsed.entries[1].values.ja).toBe('詳しく見る')
  })

  it('preserves quotes and placeholders through JSON escaping', () => {
    const { text, entries } = parseTranslationsText(fixture, 'fixture.ts')
    const value = `{count} 件の"お気に入り"`
    const result = applyEdits(text, [insertLocaleEdit(entries[0], 'ja', value)])
    expect(
      parseTranslationsText(result, 'fixture.ts').entries[0].values.ja
    ).toBe(value)
  })
})

describe('replaceLocaleEdit', () => {
  it('overwrites an existing locale value in place', () => {
    const { text, entries } = parseTranslationsText(fixture, 'fixture.ts')
    const result = applyEdits(text, [
      replaceLocaleEdit(entries[1], 'ja', '続きを読む')
    ])
    const reparsed = parseTranslationsText(result, 'fixture.ts')
    expect(reparsed.entries[1].values.ja).toBe('続きを読む')
    expect(reparsed.entries[1].values.en).toBe('Read more')
  })

  it('throws for a locale that does not exist on the entry', () => {
    const { entries } = parseTranslationsText(fixture, 'fixture.ts')
    expect(() => replaceLocaleEdit(entries[0], 'ja', 'コピー')).toThrow()
  })
})

describe('applyEdits', () => {
  it('applies edits across separate entries in one pass', () => {
    const { text, entries } = parseTranslationsText(fixture, 'fixture.ts')
    const result = applyEdits(text, [
      insertLocaleEdit(entries[0], 'ja', 'コピー'),
      replaceLocaleEdit(entries[1], 'zh-CN', '阅读更多')
    ])
    const reparsed = parseTranslationsText(result, 'fixture.ts')
    expect(reparsed.entries[0].values.ja).toBe('コピー')
    expect(reparsed.entries[1].values['zh-CN']).toBe('阅读更多')
  })
})
