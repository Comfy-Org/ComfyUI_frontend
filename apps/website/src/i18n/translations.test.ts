import { describe, expect, it } from 'vitest'

import { t } from './translations'

describe('t() fallback semantics', () => {
  it('preserves intentional empty string translations', () => {
    expect(t('models.list.heroTitle.before', 'zh-CN')).toBe('')
  })
})
