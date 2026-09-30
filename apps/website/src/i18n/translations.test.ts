import { describe, expect, it } from 'vitest'

import type { Locale } from '../config/locales'
import { LOCALE_CODES } from '../config/locales'
import type { TranslationKey } from './translations'
import { createTranslator, hasKey, t, tAround } from './translations'

const catalogSources = import.meta.glob<string>('../locales/*/*.json', {
  eager: true,
  query: '?raw',
  import: 'default'
})

type Catalog = { [key: string]: string | Catalog }

const catalogFiles = new Map(
  Object.entries(
    import.meta.glob<Catalog>('../locales/*/*.json', {
      eager: true,
      import: 'default'
    })
  )
)

function leafMessages(tree: Catalog, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap<[string, string]>(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value]]
      : leafMessages(value, `${prefix}${key}.`)
  )
}

function valuesForPlaceholders(message: string): Record<string, string> {
  const names = message
    .replace(/\{\s*'(?:[^'\\]|\\.)*'\s*\}/g, '')
    .matchAll(/\{\s*([\w$-]+)\s*\}/g)
  return Object.fromEntries([...names].map(([, name]) => [name, name]))
}

function unrenderable<Key extends string>(
  translator: {
    keys: readonly Key[]
    t: (key: Key, locale: Locale, named: Record<string, string>) => string
    tPlural: (key: Key, count: number, locale: Locale) => string
  },
  english: Catalog,
  locale: Locale
): [Key, string][] {
  const englishMessages = new Map(leafMessages(english))
  return translator.keys.flatMap<[Key, string]>((key) => {
    try {
      const message = englishMessages.get(key) ?? ''
      const syntax = message.replace(/\{\s*'(?:[^'\\]|\\.)*'\s*\}/g, '')
      if (syntax.includes('|')) {
        translator.tPlural(key, 2, locale)
      } else {
        translator.t(key, locale, valuesForPlaceholders(message))
      }
      return []
    } catch (error) {
      return [[key, error instanceof Error ? error.message : String(error)]]
    }
  })
}

const catalogs = [...catalogFiles]
  .filter(([path]) => path.startsWith('../locales/en/'))
  .map(([path, english]) => {
    const file = path.slice('../locales/en/'.length)
    const chinese = catalogFiles.get(`../locales/zh-CN/${file}`) ?? {}
    const translated = Object.fromEntries(
      LOCALE_CODES.flatMap((locale) => {
        const messages = catalogFiles.get(`../locales/${locale}/${file}`)
        return messages ? [[locale, messages]] : []
      })
    )
    const translator = createTranslator({ ...translated, en: english })
    return {
      file,
      english,
      chinese,
      unrenderable: (locale: Locale) =>
        unrenderable(translator, english, locale)
    }
  })

it.for(Object.entries(catalogSources))(
  'preserves every entry when parsing %s',
  ([, source]) => {
    const parsed: unknown = JSON.parse(source)
    expect(source).toBe(`${JSON.stringify(parsed, null, 2)}\n`)
  }
)

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

  it('refuses a message whose named values are missing', () => {
    expect(() => t('validation.minLength', 'en')).toThrow(
      'Translation validation.minLength in en needs values for {length}'
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

describe.for(catalogs)('$file', ({ english, chinese, unrenderable }) => {
  it('includes Chinese copy for every English message', () => {
    const chineseKeys = new Set(leafMessages(chinese).map(([key]) => key))
    const missing = leafMessages(english)
      .map(([key]) => key)
      .filter((key) => !chineseKeys.has(key))

    expect(missing).toEqual([])
  })

  it.for(LOCALE_CODES)('renders every %s message', (locale) => {
    expect(unrenderable(locale)).toEqual([])
  })
})

describe('createTranslator', () => {
  const catalog = createTranslator({
    en: {
      title: 'Pricing | Comfy',
      greeting: 'Hi { name }',
      hyphenated: 'Hi {first-name}',
      dollar: 'Hi {first$name}',
      item: 'Item {0}',
      contact: 'Write to support@comfy.org',
      linked: 'See @:title',
      unclosed: 'Hi {name',
      nodes: '{count} node | {count} nodes',
      unitNodes: '{count} node in {unit} | {count} nodes in {unit}',
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

  it('reads a spaced placeholder as a named value', () => {
    expect(catalog.t('greeting', 'en', { name: 'Ada' })).toBe('Hi Ada')
    expect(() => catalog.t('greeting')).toThrow(
      'Translation greeting in en needs values for {name}'
    )
  })

  it.for([
    { key: 'hyphenated', name: 'first-name' },
    { key: 'dollar', name: 'first$name' }
  ] as const)('reads {$name} as one named value', ({ key, name }) => {
    expect(() => catalog.t(key)).toThrow(
      `Translation ${key} in en needs values for {${name}}`
    )
    expect(catalog.t(key, 'en', { [name]: 'Ada' })).toBe('Hi Ada')
  })

  it('refuses a list placeholder', () => {
    expect(() => catalog.t('item')).toThrow(
      'Translation item in en uses the list placeholder {0}; name it instead'
    )
  })

  it.for(['contact', 'linked'] as const)(
    'refuses an unescaped @ in %s',
    (key) => {
      expect(() => catalog.t(key, 'ja')).toThrow(
        `Translation ${key} in ja has an unescaped "@"`
      )
    }
  )

  it('names the key and locale of a message that does not compile', () => {
    expect(() => catalog.t('unclosed', 'ja', { name: 'Ada' })).toThrow(
      'Translation unclosed in ja is not valid message syntax'
    )
  })

  it('picks plural forms by the locale plural rules', () => {
    expect(catalog.tPlural('nodes', 1, 'en')).toBe('1 node')
    expect(catalog.tPlural('nodes', 1, 'zh-CN')).toBe('1 个节点')
  })

  it('refuses a plural message with a placeholder besides {count}', () => {
    expect(() => catalog.tPlural('unitNodes', 2)).toThrow(
      'Translation unitNodes in en needs values for {unit}'
    )
  })

  it.for([
    { locale: 'en', count: 1, text: '1 node in $&' },
    { locale: 'en', count: 2, text: '2 nodes in $&' },
    { locale: 'zh-CN', count: 2, text: '$&中的 2 个节点' }
  ] as const)(
    'uses the positional count with named values in a $locale plural',
    ({ locale, count, text }) => {
      expect(
        catalog.tPlural('unitNodes', count, locale, { unit: '$&', count: 99 })
      ).toBe(text)
    }
  )

  it('preserves an explicitly empty translation', () => {
    expect(catalog.t('hero', 'zh-CN')).toBe('')
    expect(catalog.t('hero', 'en')).toBe('Hello')
  })
})

describe('createTranslator catalog checks', () => {
  it('renders a key segment that reads like vue-i18n path syntax', () => {
    const catalog = createTranslator({ en: { "items['first']": { z: 'Hi' } } })

    expect(catalog.t("items['first'].z")).toBe('Hi')
  })

  it('refuses an English key segment that contains a dot', () => {
    expect(() => createTranslator({ en: { 'a.b': 'Hi {name}' } })).toThrow(
      'Translation key a.b has a "." inside one segment'
    )
  })

  it('refuses a translated key segment that contains a dot', () => {
    const zhCN = { title: '标题', 'a.b': '你好 {name}' }

    expect(() =>
      createTranslator({
        en: { title: 'Title', a: { b: 'Hi {name}' } },
        'zh-CN': zhCN
      })
    ).toThrow('Translation key a.b has a "." inside one segment')
  })

  it('refuses a translated key the English catalog lacks', () => {
    const zhCN = { title: '标题', renamed: '旧的' }

    expect(() =>
      createTranslator({ en: { title: 'Title' }, 'zh-CN': zhCN })
    ).toThrow('Translations in zh-CN have no English message: renamed')
  })

  it('refuses a translated message where English has a group', () => {
    const zhCN = { nested: '形状不对' }

    expect(() =>
      // @ts-expect-error a translated catalog must keep the English shape
      createTranslator({ en: { nested: { title: 'x' } }, 'zh-CN': zhCN })
    ).toThrow('Translations in zh-CN have no English message: nested')
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

  it.for<{
    key: TranslationKey
    slot: string
    named: Record<string, string | number>
    error: string
  }>([
    {
      key: 'models.faq.whatIs.localAnswer',
      slot: 'name',
      named: { description: 'a model', count: 3 },
      error: 'repeats slot {name}'
    },
    {
      key: 'models.list.heroTitle',
      slot: 'creators',
      named: { name: 'Flux', brand: 'ComfyUI' },
      error: 'missing slot {creators}'
    }
  ])(
    'throws "$error" for a slot that is not in the message exactly once',
    ({ key, slot, named, error }) => {
      expect(() => tAround(key, 'en', slot, named)).toThrow(error)
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
