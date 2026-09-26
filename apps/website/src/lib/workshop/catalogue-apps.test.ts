import { describe, expect, it } from 'vitest'

import { catalogueApps } from './catalogue-apps'

describe('catalogueApps', () => {
  it.for([
    { locale: 'en', names: ['Cinematic Studio', 'Re-shoot a video'] },
    { locale: 'zh-CN', names: ['电影工作室', '重拍视频'] }
  ] as const)(
    'lists the two apps that open today in $locale',
    ({ locale, names }) => {
      expect(catalogueApps(locale).map((app) => app.name)).toEqual(names)
    }
  )

  it('opens Re-shoot inside Cinematic Studio', () => {
    expect(catalogueApps().map((app) => app.href)).toEqual([
      '/cinematic-studio',
      '/cinematic-studio?app=reshoot'
    ])
  })
})
