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
        'Hand product swap'
      ]
    },
    {
      locale: 'zh-CN',
      names: ['电影工作室', '重拍视频', '随意移动', '重新布光', '手持产品替换']
    }
  ] as const)('names every app in $locale', ({ locale, names }) => {
    expect([
      ac('studioName', locale),
      ac('reshootName', locale),
      ac('moveAnythingName', locale),
      ac('relightName', locale),
      ac('handProductSwapName', locale)
    ]).toEqual(names)
  })
})
