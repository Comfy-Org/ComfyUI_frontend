import { describe, expect, it } from 'vitest'

import { ac } from './catalogue-apps'

describe('app catalogue copy', () => {
  it.for([
    {
      locale: 'en',
      names: ['Cinematic Studio', 'Re-shoot a video', 'Paparazzi me']
    },
    {
      locale: 'zh-CN',
      names: ['电影工作室', '重拍视频', '狗仔偶遇']
    }
  ] as const)('names every app in $locale', ({ locale, names }) => {
    expect([
      ac('studioName', locale),
      ac('reshootName', locale),
      ac('paparazziMeName', locale)
    ]).toEqual(names)
  })
})
