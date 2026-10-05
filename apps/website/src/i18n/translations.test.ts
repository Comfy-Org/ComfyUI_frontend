import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import type { Locale } from '@/config/locales'
import { LOCALE_CODES } from '@/config/locales'
import { translationsFor } from './translations'

type Catalog = { [key: string]: string | Catalog }

const catalogSources = import.meta.glob<string>('@/locales/*/*.json', {
  eager: true,
  query: '?raw',
  import: 'default'
})

function isCatalog(value: unknown): value is Catalog {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (entry: unknown) => typeof entry === 'string' || isCatalog(entry)
    )
  )
}

function parseCatalog(path: string, source: string): Catalog {
  const parsed: unknown = JSON.parse(source)
  if (!isCatalog(parsed)) {
    throw new Error(`Catalog ${path} must contain nested string messages`)
  }
  return parsed
}

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

const catalogFiles = new Map(
  Object.entries(catalogSources).map(([path, source]) => [
    path,
    parseCatalog(path, source)
  ])
)

const catalogs = [...catalogFiles]
  .filter(([path]) => path.startsWith('/src/locales/en/'))
  .map(([path, english]) => {
    const file = path.slice('/src/locales/en/'.length)
    const messages = Object.fromEntries(
      LOCALE_CODES.flatMap((locale) => {
        const catalog = catalogFiles.get(`/src/locales/${locale}/${file}`)
        return catalog ? [[locale, catalog]] : []
      })
    )
    return { file, english, messages }
  })

describe('site translations', () => {
  it('discovers the English catalogs', () => {
    expect(catalogs.map(({ file }) => file)).toContain('main.json')
  })

  it('binds translations to a locale', () => {
    expect(translationsFor('zh-CN').t('hero.title')).toBe(
      '视觉 AI 的\n最强可控性'
    )
  })

  it('falls back from Japanese to English', () => {
    const { t } = translationsFor('ja')
    expect(t('hero.title')).toBe('ビジュアルAIを自在にコントロール')
    expect(t('tags.partnerNodes')).toBe('Partner Nodes')
  })

  it.for([
    ['en', '42 models'],
    ['zh-CN', '42 个模型'],
    ['ja', '42 models']
  ] as const)('renders the model directory count in %s', ([locale, text]) => {
    expect(
      translationsFor(locale).t('workshop.catalogue.directoryCount', {
        count: 42
      })
    ).toBe(text)
  })

  it.for([
    { locale: 'en', count: 1, expected: '1 node' },
    { locale: 'en', count: 2, expected: '2 nodes' },
    { locale: 'zh-CN', count: 2, expected: '2 个节点' }
  ] as const)(
    'renders $locale plural copy for $count',
    ({ locale, count, expected }) => {
      const { t } = translationsFor(locale)
      expect(
        t('cloudNodesLaunch.models.nodeCount', { count }, { plural: count })
      ).toBe(expected)
    }
  )
})

describe.for(catalogs)('$file catalog', ({ english, messages }) => {
  it('includes Chinese copy for every English message', () => {
    const chinese = messages['zh-CN'] ?? {}
    const chineseKeys = new Set(leafMessages(chinese).map(([key]) => key))
    const missing = leafMessages(english)
      .map(([key]) => key)
      .filter((key) => !chineseKeys.has(key))

    expect(missing).toEqual([])
  })

  it.for(LOCALE_CODES)('renders every %s message', (locale: Locale) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      fallbackLocale: 'en',
      messages,
      missingWarn: false,
      fallbackWarn: false,
      warnHtmlMessage: false
    })
    const localized = new Map(leafMessages(messages[locale] ?? {}))
    const failures = leafMessages(english).flatMap(([key, fallback]) => {
      const message = localized.get(key) ?? fallback
      const values = valuesForPlaceholders(message)
      try {
        i18n.global.t(key, values, { locale, plural: 2 })
        return []
      } catch (error) {
        return [[key, error instanceof Error ? error.message : String(error)]]
      }
    })

    expect(failures).toEqual([])
  })
})
