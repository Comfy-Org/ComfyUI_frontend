import { describe, expect, it } from 'vitest'

import type { Locale } from '@/i18n/translations'
import { t } from '@/i18n/translations'
import { modelTitle, workflowTitle } from './model-title'

const nameOfLength = (length: number) => 'x'.repeat(length)
const full = (name: string, locale: Locale = 'en') =>
  t('workshop.model.meta.title', { name }, { locale })
const unbranded = (name: string) =>
  t('workshop.model.meta.titleUnbranded', { name }, { locale: 'en' })
const apiOnly = (name: string) =>
  t('workshop.model.meta.titleApi', { name }, { locale: 'en' })

describe('modelTitle', () => {
  it.for([
    {
      name: 'names the API and playground when they fit',
      modelName: 'Seedream 4.0',
      expected: full('Seedream 4.0')
    },
    {
      name: 'keeps the full title at exactly the limit',
      modelName: nameOfLength(35),
      expected: full(nameOfLength(35))
    },
    {
      name: 'drops the brand before the playground',
      modelName: nameOfLength(36),
      expected: unbranded(nameOfLength(36))
    },
    {
      name: 'keeps the unbranded title at exactly the limit',
      modelName: nameOfLength(43),
      expected: unbranded(nameOfLength(43))
    },
    {
      name: 'falls back to the API title when the playground no longer fits',
      modelName: nameOfLength(44),
      expected: apiOnly(nameOfLength(44))
    },
    {
      name: 'keeps the whole name in the API title at exactly the limit',
      modelName: nameOfLength(48),
      expected: apiOnly(nameOfLength(48))
    },
    {
      name: 'shortens a longer name at a word boundary',
      modelName:
        'Seed Audio 1.0 Multilingual Text-to-Speech with Voice Cloning Preview',
      expected: apiOnly('Seed Audio 1.0 Multilingual Text-to-Speech with…')
    },
    {
      name: 'cuts a long name with no spaces to fit',
      modelName: nameOfLength(70),
      expected: apiOnly(`${nameOfLength(47)}…`)
    },
    {
      name: 'writes the Chinese title with the Chinese conjunction',
      locale: 'zh-CN' as const,
      modelName: 'Seedream 4.0',
      expected: full('Seedream 4.0', 'zh-CN')
    }
  ])('$name', ({ modelName, locale, expected }) => {
    const title = modelTitle({ name: modelName }, locale)
    expect(title).toBe(expected)
    expect(title.length).toBeLessThanOrEqual(60)
  })
})

describe('workflowTitle', () => {
  const titleSuffix = (locale: Locale) =>
    t('workshop.workflow.meta.title', { name: '' }, { locale })

  it.for(['en', 'ja', 'zh-CN'] as const)(
    'shortens a 100-character name at a word to fit 60 characters in %s',
    (locale) => {
      const title = workflowTitle(
        { name: 'Relight '.repeat(13).slice(0, 100) },
        locale
      )
      expect(title.length).toBeLessThanOrEqual(60)
      expect(title.endsWith(`Relight…${titleSuffix(locale)}`)).toBe(true)
    }
  )

  it.for(['en', 'ja', 'zh-CN'] as const)(
    'does not split an emoji when it cuts a name in %s',
    (locale) => {
      const title = workflowTitle({ name: '😀'.repeat(60) }, locale)
      expect(title.length).toBeLessThanOrEqual(60)
      expect(title).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
    }
  )
})
