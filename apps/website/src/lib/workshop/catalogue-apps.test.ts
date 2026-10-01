import { describe, expect, it } from 'vitest'

import { ac } from './catalogue-apps'

describe('app catalogue copy', () => {
  it.for([
    {
      locale: 'en',
      names: [
        'Cinematic Studio',
        'Re-shoot a video',
        'Move anything',
        'Relight',
        'Sprite Sheet Generator'
      ]
    },
    {
      locale: 'zh-CN',
      names: ['电影工作室', '重拍视频', '随意移动', '重新布光', '精灵图生成器']
    }
  ] as const)('names every app in $locale', ({ locale, names }) => {
    expect([
      ac('studioName', locale),
      ac('reshootName', locale),
      ac('moveAnythingName', locale),
      ac('relightName', locale),
      ac('spriteSheetName', locale)
    ]).toEqual(names)
  })
})
