import { describe, expect, it } from 'vitest'

import { t, translationKeys } from './translations'

describe('translation keys', () => {
  it('never uses a key as the prefix of another key', () => {
    const keys = new Set<string>(translationKeys)
    const collisions = translationKeys.filter((key) => {
      const segments = key.split('.')
      return segments
        .slice(1)
        .some((_, index) => keys.has(segments.slice(0, index + 1).join('.')))
    })
    expect(collisions).toEqual([])
  })
})

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
