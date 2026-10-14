import { describe, expect, it } from 'vitest'

import { ac } from './catalogue-apps'

describe('app catalogue copy', () => {
  it.for([
    {
      locale: 'en',
      names: ['Cinematic Studio', 'Re-shoot a video', 'Hand product swap']
    },
    {
      locale: 'zh-CN',
      names: ['电影工作室', '重拍视频', '手持产品替换']
    }
  ] as const)('names every app in $locale', ({ locale, names }) => {
    expect([
      ac('studioName', locale),
      ac('reshootName', locale),
      ac('handProductSwapName', locale)
    ]).toEqual(names)
  })
})
