import { describe, expect, it } from 'vitest'

import { t } from './translations'

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
