import { describe, expect, it } from 'vitest'

import { localePageFiles, localeStaticPaths } from './localeStaticPaths'

describe('localeStaticPaths', () => {
  it.for([
    { routePattern: '/[...locale]', locales: [undefined, 'zh-CN', 'ja'] },
    { routePattern: '/[...locale]/careers', locales: [undefined, 'zh-CN'] },
    { routePattern: '/[...locale]/terms-of-service', locales: [undefined] }
  ])(
    'serves $routePattern in the locales that publish it',
    ({ routePattern, locales }) => {
      expect(
        localeStaticPaths({ routePattern }).map(({ params }) => params.locale)
      ).toEqual(locales)
    }
  )

  it('rejects a page outside src/pages/[...locale]/', () => {
    expect(() => localeStaticPaths({ routePattern: '/careers' })).toThrow(
      'src/pages/[...locale]/'
    )
  })
})

describe('localePageFiles', () => {
  it.for([
    [
      '[...locale]/index.astro',
      ['index.astro', 'zh-CN/index.astro', 'ja/index.astro']
    ],
    [
      '[...locale]/cloud/index.astro',
      ['cloud/index.astro', 'zh-CN/cloud/index.astro']
    ],
    ['careers.astro', ['careers.astro']]
  ] as const)('expands %s', ([file, served]) => {
    expect(localePageFiles(file)).toEqual(served)
  })
})
