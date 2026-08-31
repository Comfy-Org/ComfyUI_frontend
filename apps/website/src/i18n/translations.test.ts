import { describe, it, expect } from 'vitest'
import type { Locale } from './translations'
import { t } from './translations'

describe('t() fallback semantics', () => {
  it('falls back to English when a requested locale is missing', () => {
    // 'ja' is missing in PR1, so it should fall back to English.
    expect(t('hero.title', 'ja' as unknown as Locale)).toBe(
      'Professional Control\nof Visual AI'
    )
  })

  it('preserves intentional empty string translations', () => {
    // 'test.emptyValue' is added specifically to test this semantic.
    expect(t('test.emptyValue', 'zh-CN')).toBe('')
  })
})
