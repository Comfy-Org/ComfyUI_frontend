import { describe, expect, it } from 'vitest'

import { isLocale, localeHasRoute } from './locales'

describe('localeHasRoute', () => {
  it.for([
    { locale: 'en', route: '/', served: true },
    { locale: 'en', route: '/cli', served: true },
    { locale: 'en', route: '/anything-at-all', served: true },
    { locale: 'zh-CN', route: '/', served: true },
    { locale: 'zh-CN', route: '/cli', served: true },
    { locale: 'ja', route: '/', served: true },
    { locale: 'ja', route: '/pricing', served: false },
    { locale: 'ja', route: '/cli', served: false },
    { locale: 'ja', route: '/mcp', served: false }
  ] as const)('$locale serves $route: $served', ({ locale, route, served }) => {
    expect(localeHasRoute(locale, route)).toBe(served)
  })
})

describe('isLocale', () => {
  it.for([
    { value: 'en', supported: true },
    { value: 'zh-CN', supported: true },
    { value: 'ja', supported: true },
    { value: 'fr', supported: false },
    { value: undefined, supported: false },
    { value: 'toString', supported: false },
    { value: 'constructor', supported: false },
    { value: 'hasOwnProperty', supported: false }
  ])('$value is supported: $supported', ({ value, supported }) => {
    expect(isLocale(value)).toBe(supported)
  })
})
