import { describe, expect, it } from 'vitest'

import type { Locale, LocalizedText } from '@/i18n/translations'

import type { CopyValues } from './app-copy'
import { appCopy } from './app-copy'

const lights: LocalizedText = {
  en: '{n} light | {n} lights',
  'zh-CN': '{n} 盏灯'
}

describe('appCopy', () => {
  it.for<{
    entry: LocalizedText
    locale: Locale
    named: CopyValues
    text: string
  }>([
    {
      entry: { en: 'Run', 'zh-CN': '运行' },
      locale: 'zh-CN',
      named: {},
      text: '运行'
    },
    { entry: lights, locale: 'en', named: { n: 1 }, text: '1 light' },
    { entry: lights, locale: 'en', named: { n: 3 }, text: '3 lights' },
    { entry: lights, locale: 'zh-CN', named: { n: 3 }, text: '3 盏灯' },
    {
      entry: { en: 'Hello {name}, {missing}', 'zh-CN': '你好 {name}' },
      locale: 'en',
      named: { name: 'Ada' },
      text: 'Hello Ada, {missing}'
    }
  ])(
    'reads $entry.en in $locale as "$text"',
    ({ entry, locale, named, text }) => {
      expect(appCopy(entry, locale, named)).toBe(text)
    }
  )
})
