import { describe, expect, it } from 'vitest'

import { resolveTranslation, t } from './translations'

describe('t() fallback semantics', () => {
  it('returns Japanese copy when it exists', () => {
    expect(t('hero.title', 'ja')).toBe('ビジュアルAIを自在にコントロール')
  })

  it('falls back to English when Japanese copy is missing', () => {
    expect(t('tags.partnerNodes', 'ja')).toBe('Partner Nodes')
  })

  it('preserves intentional empty string translations', () => {
    expect(t('models.list.heroTitle.before', 'zh-CN')).toBe('')
  })
})

/**
 * The layered lookup, wired to the real machine-translation files.
 *
 * `resolveValue` is unit-tested on its own; these assert the wiring, which is
 * where the promise actually lives: the pipeline may fill Japanese, and it may
 * never overwrite approved Chinese.
 */
describe('resolveTranslation provenance', () => {
  it('reports English as the source, never as a translation', () => {
    expect(resolveTranslation('tags.partnerNodes', 'en')).toEqual({
      value: 'Partner Nodes',
      provenance: 'english'
    })
  })

  it('reports hand-written Chinese as approved', () => {
    const resolved = resolveTranslation('tags.partnerNodes', 'zh-CN')
    expect(resolved.provenance).toBe('approved')
    expect(resolved.value).toBe('合作伙伴节点')
  })

  it('reports hand-written Japanese as approved', () => {
    expect(resolveTranslation('hero.title', 'ja').provenance).toBe('approved')
  })

  /**
   * Japanese is barely started, so most keys still fall through to English.
   * That is the signal the indexability predicate will consume: a page built
   * from keys resolving to `english` is not genuinely translated.
   */
  it('reports an untranslated key as English, not as a translation', () => {
    expect(resolveTranslation('tags.partnerNodes', 'ja')).toEqual({
      value: 'Partner Nodes',
      provenance: 'english'
    })
  })
})
