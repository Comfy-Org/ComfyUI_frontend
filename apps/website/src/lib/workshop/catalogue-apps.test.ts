import { describe, expect, it } from 'vitest'

import { ac } from './catalogue-apps'

describe('app catalogue copy', () => {
  it.for([
    {
      locale: 'en',
      names: ['Cinematic Studio', 'Re-shoot a video', 'Sprite Sheet Generator']
    },
    {
      locale: 'zh-CN',
      names: ['电影工作室', '重拍视频', '精灵图生成器']
    }
  ] as const)('names every app in $locale', ({ locale, names }) => {
    expect([
      ac('studioName', locale),
      ac('reshootName', locale),
      ac('spriteSheetName', locale)
    ]).toEqual(names)
  })
})
