import { describe, expect, it } from 'vitest'

import type { Locale } from '../config/locales'
import { LOCALE_CODES } from '../config/locales'
import cinematicEn from '../locales/en/cinematic.json' with { type: 'json' }
import cinematicJa from '../locales/ja/cinematic.json' with { type: 'json' }
import reshootEn from '../locales/en/reshoot.json' with { type: 'json' }
import reshootJa from '../locales/ja/reshoot.json' with { type: 'json' }
import routerEn from '../locales/en/router.json' with { type: 'json' }
import routerJa from '../locales/ja/router.json' with { type: 'json' }
import cinematicZhCN from '../locales/zh-CN/cinematic.json' with { type: 'json' }
import reshootZhCN from '../locales/zh-CN/reshoot.json' with { type: 'json' }
import routerZhCN from '../locales/zh-CN/router.json' with { type: 'json' }
import type { TranslationKey } from './translations'
import {
  createTranslator,
  hasKey,
  t,
  tAround,
  translationKeys
} from './translations'

const pluralKeys: readonly string[] = ['cloudNodesLaunch.models.nodeCount']

function unrenderable<Key extends string>(
  translator: { keys: readonly Key[]; t: (key: Key, locale: Locale) => string },
  locale: Locale
): Key[] {
  return translator.keys
    .filter((key) => !pluralKeys.includes(key))
    .filter((key) => {
      try {
        translator.t(key, locale)
        return false
      } catch {
        return true
      }
    })
}

const catalogs = [
  {
    file: 'main.json',
    unrenderable: (locale: Locale) =>
      unrenderable({ keys: translationKeys, t }, locale)
  },
  {
    file: 'cinematic.json',
    unrenderable: (locale: Locale) =>
      unrenderable(
        createTranslator({
          en: cinematicEn,
          'zh-CN': cinematicZhCN,
          ja: cinematicJa
        }),
        locale
      )
  },
  {
    file: 'reshoot.json',
    unrenderable: (locale: Locale) =>
      unrenderable(
        createTranslator({
          en: reshootEn,
          'zh-CN': reshootZhCN,
          ja: reshootJa
        }),
        locale
      )
  },
  {
    file: 'router.json',
    unrenderable: (locale: Locale) =>
      unrenderable(
        createTranslator({ en: routerEn, 'zh-CN': routerZhCN, ja: routerJa }),
        locale
      )
  }
]

describe('translation keys', () => {
  it('never uses a key as the prefix of another key', () => {
    const keys = new Set<string>(translationKeys)
    const collisions = translationKeys.filter((key) => {
      const segments = key.split('.')
      return segments
        .slice(1)
        .some((_, index) => keys.has(segments.slice(0, index + 1).join('.')))
    })
    expect(collisions).toEqual([])
  })
})

describe('t()', () => {
  it('returns Japanese copy when it exists', () => {
    expect(t('hero.title', 'ja')).toBe('ビジュアルAIを自在にコントロール')
  })

  it('falls back to English when Japanese copy is missing', () => {
    expect(t('tags.partnerNodes', 'ja')).toBe('Partner Nodes')
  })

  it('interpolates named values in the locale word order', () => {
    expect(
      t('models.list.heroTitle', 'zh-CN', { name: 'Flux', brand: 'ComfyUI' })
    ).toBe('ComfyUI 中的 Flux')
  })

  it('fills every occurrence of a repeated placeholder', () => {
    const message = t('models.faq.whatIs.localAnswer', 'en', {
      name: 'Flux',
      description: 'a model',
      count: 3
    })

    expect(message.match(/Flux/g)).toHaveLength(3)
    expect(message).not.toMatch(/\{\w+\}/)
  })

  it('inserts values literally', () => {
    expect(t('validation.minLength', 'en', { length: '$&' })).toBe(
      'Must be at least $& characters'
    )
  })

  it('keeps missing named values visible', () => {
    expect(t('validation.minLength', 'en')).toBe(
      'Must be at least {length} characters'
    )
  })

  it.for([
    { key: 'auth.errors.signupBlocked', text: 'support@comfy.org' },
    { key: 'fdct.meta.title', text: 'Forward Deployed Creatives | Comfy' },
    { key: 'workshop.workflow.apiPoll', text: 'GET /api/jobs/{prompt_id}?' }
  ] as const)('renders the escaped literals in $key', ({ key, text }) => {
    expect(t(key)).toContain(text)
  })

  it('refuses a key the catalog does not have', () => {
    const builtKey = 'cloud.faq.99.q' as TranslationKey

    expect(() => t(builtKey)).toThrow('Unknown translation key cloud.faq.99.q')
  })

  it('refuses a plural message', () => {
    expect(() => t('cloudNodesLaunch.models.nodeCount')).toThrow(
      'read plural forms with tPlural'
    )
  })

  it('keeps interleaved page locales isolated', () => {
    expect(t('hero.title', 'ja')).toBe('ビジュアルAIを自在にコントロール')
    expect(t('hero.title', 'en')).toBe('Professional Control\nof Visual AI')
    expect(t('hero.title', 'ja')).toBe('ビジュアルAIを自在にコントロール')
  })
})

describe.for(catalogs)('$file', ({ unrenderable }) => {
  it.for(LOCALE_CODES)('renders every %s message', (locale) => {
    expect(unrenderable(locale)).toEqual([])
  })
})

describe('createTranslator', () => {
  const catalog = createTranslator({
    en: {
      title: 'Pricing | Comfy',
      greeting: 'Hi { name }',
      item: 'Item {0}',
      contact: 'Write to support@comfy.org',
      nodes: '{count} node | {count} nodes',
      hero: 'Hello'
    },
    'zh-CN': {
      nodes: '一个节点 | {count} 个节点',
      hero: ''
    }
  })

  it('refuses a literal pipe that is not escaped', () => {
    expect(() => catalog.t('title')).toThrow(
      `Translation title in en has an unescaped "|"`
    )
  })

  it('keeps a spaced placeholder visible when its value is missing', () => {
    expect(catalog.t('greeting')).toBe('Hi { name }')
  })

  it('refuses a list placeholder', () => {
    expect(() => catalog.t('item')).toThrow(
      'Translation item in en uses the list placeholder {0}; name it instead'
    )
  })

  it('names the key and locale of a message that does not compile', () => {
    expect(() => catalog.t('contact', 'ja')).toThrow(
      'Translation contact in ja is not valid message syntax'
    )
  })

  it('picks plural forms by the locale plural rules', () => {
    expect(catalog.tPlural('nodes', 1, 'en')).toBe('1 node')
    expect(catalog.tPlural('nodes', 1, 'zh-CN')).toBe('1 个节点')
  })

  it('preserves an explicitly empty translation', () => {
    expect(catalog.t('hero', 'zh-CN')).toBe('')
    expect(catalog.t('hero', 'en')).toBe('Hello')
  })
})

describe('tAround', () => {
  it.for([
    { locale: 'en', parts: ['Flux in ', ''] },
    { locale: 'zh-CN', parts: ['', ' 中的 Flux'] }
  ] as const)(
    'splits the $locale message around the slot',
    ({ locale, parts }) => {
      expect(
        tAround('models.list.heroTitle', locale, 'brand', { name: 'Flux' })
      ).toEqual(parts)
    }
  )

  it('keeps a value shaped like the slot marker literal', () => {
    expect(
      tAround('models.list.heroTitle', 'en', 'brand', { name: '{brand}' })
    ).toEqual(['{brand} in ', ''])
  })

  it.for([
    {
      key: 'models.faq.whatIs.localAnswer',
      slot: 'name',
      error: 'repeats slot {name}'
    },
    {
      key: 'models.list.heroTitle',
      slot: 'creators',
      error: 'missing slot {creators}'
    }
  ] as const)(
    'throws "$error" for a slot that is not in the message exactly once',
    ({ key, slot, error }) => {
      expect(() =>
        tAround(key, 'en', slot, { description: 'a model', count: 3 })
      ).toThrow(error)
    }
  )
})

describe('hasKey', () => {
  it('accepts leaf keys only', () => {
    expect(hasKey('hero.title')).toBe(true)
    expect(hasKey('hero')).toBe(false)
    expect(hasKey('toString')).toBe(false)
  })
})
