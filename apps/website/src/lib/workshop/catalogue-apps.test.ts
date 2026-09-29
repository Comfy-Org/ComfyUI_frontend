import { describe, expect, it } from 'vitest'

import { ac } from './catalogue-apps'

describe('app catalogue copy', () => {
  it.for([
    { locale: 'en', names: ['Cinematic Studio', 'Re-shoot a video'] },
    { locale: 'zh-CN', names: ['电影工作室', '重拍视频'] }
  ] as const)(
    'lists the two apps that open today in $locale',
    ({ locale, names }) => {
      expect([ac('studioName', locale), ac('reshootName', locale)]).toEqual(
        names
      )
    }
  )
})
