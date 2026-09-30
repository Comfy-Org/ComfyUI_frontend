import { describe, expect, it } from 'vitest'

import { routerT } from './routerCopy'

describe('routerT', () => {
  it.for([
    { locale: 'en', expected: 'Browse all models' },
    { locale: 'zh-CN', expected: '浏览全部模型' }
  ] as const)('returns the browse label in $locale', ({ locale, expected }) => {
    expect(routerT('platform.router.coverage.browseAll', locale)).toBe(expected)
  })
})
