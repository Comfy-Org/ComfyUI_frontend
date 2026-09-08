import { describe, expect, it } from 'vitest'

import { collectViolations } from './validate'

const TERMS = ['ComfyUI', 'Comfy Cloud', 'MiniMax H3', 'API']

/** Only the kinds, which is what a caller acts on. Details are for humans. */
function kinds(
  english: Record<string, string>,
  translated: Record<string, string>,
  locale: 'ja' | 'zh-CN' = 'ja'
): string[] {
  return collectViolations(english, translated, locale, TERMS).map(
    (v) => v.kind
  )
}

describe('collectViolations', () => {
  it('passes a clean translation', () => {
    expect(
      kinds(
        { 'a.b': 'Run ComfyUI in the cloud with {count} nodes.' },
        { 'a.b': '{count} 個のノードでクラウド上の ComfyUI を実行します。' }
      )
    ).toEqual([])
  })

  it('says nothing about a key the model has not translated yet', () => {
    // Absence is normal and is handled by the indexing predicate, not here.
    expect(kinds({ 'a.b': 'Hello there friend' }, {})).toEqual([])
  })

  describe('placeholders', () => {
    it('catches a dropped placeholder', () => {
      expect(
        kinds(
          { 'a.b': 'Welcome {email} to Comfy' },
          { 'a.b': 'ようこそ Comfy へ' }
        )
      ).toEqual(['placeholder'])
    })

    it('catches an invented placeholder', () => {
      expect(
        kinds({ 'a.b': 'Welcome to Comfy' }, { 'a.b': 'ようこそ {user} さん' })
      ).toEqual(['placeholder'])
    })

    /**
     * A translated placeholder name is the nastiest version: it still looks like
     * a placeholder, so nothing downstream complains, and the page renders a
     * literal `{数}` to the reader.
     */
    it('catches a translated placeholder name', () => {
      expect(
        kinds({ 'a.b': 'You have {count} left' }, { 'a.b': '残り {数} 件' })
      ).toEqual(['placeholder'])
    })
  })

  it('catches a mangled URL', () => {
    expect(
      kinds(
        { 'a.b': 'See https://comfy.org/cli for more' },
        { 'a.b': '詳しくは https://comfy.org/シーエルアイ をご覧ください' }
      )
    ).toEqual(['url'])
  })

  /**
   * `Wan` is a video model and also the first three letters of `Want`. A
   * substring test demanded the Japanese for "Want to build tools" contain
   * "Wan", which is impossible, so 51 real strings could never pass. Brand
   * names are words.
   */
  it('does not see a brand name inside an ordinary word', () => {
    expect(
      collectViolations(
        { 'a.b': 'Want to build tools that empower others to create.' },
        { 'a.b': '他の人が創作できるツールを作りたい。' },
        'ja',
        ['Wan']
      )
    ).toEqual([])
  })

  it('still catches the brand name when it is genuinely used', () => {
    expect(
      kinds(
        { 'a.b': 'Generate video with Wan and friends' },
        { 'a.b': 'ビデオを生成します' }
      ).filter((k) => k === 'glossary')
    ).toEqual([])
    // TERMS above has no `Wan`; assert against a list that does.
    expect(
      collectViolations(
        { 'a.b': 'Generate video with Wan' },
        { 'a.b': 'ビデオを生成します' },
        'ja',
        ['Wan']
      ).map((v) => v.kind)
    ).toEqual(['glossary'])
  })

  it('catches a preserve term that was translated away', () => {
    expect(
      kinds(
        { 'a.b': 'Run ComfyUI locally on your machine' },
        { 'a.b': 'コンフィUI をローカルで実行します' }
      )
    ).toEqual(['glossary'])
  })

  it('catches lost line structure', () => {
    // Several strings are two-line headings; collapsing them breaks layout.
    expect(
      kinds(
        { 'a.b': 'Build anything\nwith any model' },
        { 'a.b': 'あらゆるモデルであらゆるものを構築' }
      )
    ).toEqual(['structure'])
  })

  describe('target script', () => {
    it('catches a translation left entirely in English', () => {
      expect(
        kinds(
          { 'a.b': 'Generate video from a single reference image' },
          { 'a.b': 'Generate video from a single reference image' }
        )
      ).toEqual(['script'])
    })

    /**
     * A string that is only proper nouns, placeholders and punctuation has no
     * translatable words, so demanding Japanese script would fail it forever.
     */
    it('exempts a string with nothing translatable in it', () => {
      expect(kinds({ 'a.b': 'ComfyUI API' }, { 'a.b': 'ComfyUI API' })).toEqual(
        []
      )
    })

    it('exempts short labels', () => {
      expect(kinds({ 'a.b': 'Docs' }, { 'a.b': 'Docs' })).toEqual([])
    })
  })

  it('catches hype the English never claimed, once per word', () => {
    // Two banned words, so two findings: a reviewer fixing this needs to be
    // told about both, not just the first one encountered.
    expect(
      kinds(
        { 'a.b': 'A node-based editor for image generation' },
        { 'a.b': 'A powerful and seamless node editor' }
      )
    ).toEqual(['script', 'brand-voice', 'brand-voice'])
  })

  it('reports the key and locale so a human can find it', () => {
    const [violation] = collectViolations(
      { 'hero.title': 'Welcome {email}' },
      { 'hero.title': 'ようこそ' },
      'ja',
      TERMS
    )
    expect(violation.key).toBe('hero.title')
    expect(violation.locale).toBe('ja')
    expect(violation.detail).toContain('{email}')
  })
})
