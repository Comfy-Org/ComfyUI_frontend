import { describe, expect, it } from 'vitest'

import { ac } from './catalogue-apps'

describe('app catalogue copy', () => {
  it.for([
    {
      locale: 'en',
      names: ['Cinematic Studio', 'Re-shoot a video', 'Move anything']
    },
    { locale: 'zh-CN', names: ['电影工作室', '重拍视频', '随意移动'] }
  ] as const)('names every app in $locale', ({ locale, names }) => {
    expect([
      ac('studioName', locale),
      ac('reshootName', locale),
      ac('moveAnythingName', locale)
    ]).toEqual(names)
  })
})
