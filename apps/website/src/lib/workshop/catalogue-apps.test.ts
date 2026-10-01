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
        'Background Removal'
      ]
    },
    {
      locale: 'zh-CN',
      names: ['电影工作室', '重拍视频', '随意移动', '重新布光', '背景移除']
    }
  ] as const)('names every app in $locale', ({ locale, names }) => {
    expect([
      ac('studioName', locale),
      ac('reshootName', locale),
      ac('moveAnythingName', locale),
      ac('relightName', locale),
      ac('backgroundRemovalName', locale)
    ]).toEqual(names)
  })
})
