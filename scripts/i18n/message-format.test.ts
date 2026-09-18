import { expect, it } from 'vitest'

import { translationPipelineConfig } from './config'
import type { MessageFormat } from './config'
import { collectLeaves, pathKey } from './locale-tree'
import {
  auditProtectedLiterals,
  leafTokensDiffer,
  tokenErrors,
  validateLocale
} from './protected-tokens'
import { translateLocaleItems } from './translate'
import { auditRetainedTranslations } from './translation-ownership'
import { buildTranslationItems } from './update-locales'

it.for<{ format: MessageFormat; target: string; errors: string[] }>([
  {
    format: 'intlify',
    target: '文本 {name} | 内容',
    errors: ['added plural separator |']
  },
  { format: 'text', target: '文本 {name} | 内容', errors: [] },
  {
    format: 'intlify',
    target: '文本 {name} @:label',
    errors: ['added linked message @']
  },
  { format: 'text', target: '文本 {name} @:label', errors: [] },
  { format: 'text', target: '文本 | 内容', errors: ['missing {name}'] }
])(
  'validates $format content consistently: $target',
  ({ format, target, errors }) => {
    const source = { title: 'Hello {name}' }
    const translated = { title: target }
    const labeled = errors.map((error) => `title: ${error}`)
    expect(tokenErrors(source.title, target, true, format)).toEqual(errors)
    expect(leafTokensDiffer(source.title, target, format)).toBe(
      errors.length > 0
    )
    expect(
      auditProtectedLiterals(source, translated, new Set(), format)
    ).toEqual(labeled)
    expect(
      validateLocale(
        source,
        translated,
        { added: [], modified: [['title']], deleted: [] },
        format
      )
    ).toEqual(labeled)
    expect(
      auditRetainedTranslations(
        source,
        new Map([[pathKey(['title']), target]]),
        format
      )
    ).toEqual(labeled)
  }
)

it('carries Markdown format into generation without treating pipes as plurals', async () => {
  const source = { body: 'Hello {name}' }
  const plan = buildTranslationItems(
    'content.json',
    [...collectLeaves(source).values()],
    'text'
  )
  const translated = await translateLocaleItems(
    { code: 'zh-CN', name: 'Chinese' },
    plan.items,
    async () => ({ '1': '文本 {name} | 内容' }),
    { ...translationPipelineConfig, maxTranslationRounds: 1 }
  )
  expect(translated.get('1')).toBe('文本 {name} | 内容')
})
