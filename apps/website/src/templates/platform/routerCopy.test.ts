import { describe, expect, it } from 'vitest'

import { routerT } from './routerCopy'

describe('routerT', () => {
  it.for([
    { locale: 'en', expected: 'Browse all 120 models' },
    { locale: 'zh-CN', expected: '浏览全部 120 个模型' }
  ] as const)(
    'fills named values in the $locale message',
    ({ locale, expected }) => {
      expect(
        routerT(
          'platform.router.coverage.browseAll',
          { count: 120 },
          { locale: locale }
        )
      ).toBe(expected)
    }
  )
})
