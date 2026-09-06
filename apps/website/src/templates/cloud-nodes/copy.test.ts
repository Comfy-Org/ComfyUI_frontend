import { describe, expect, it } from 'vitest'

import type { Locale, TranslationKey } from '../../i18n/translations'

import { hasKey, t } from '../../i18n/translations'

const locales: Locale[] = ['en', 'zh-CN']

// The sections build these with template literals, so TypeScript cannot check
// them: `cloudNodesLaunch.faq.${n}.q` is a string until it reaches t(), which
// throws on a key that does not exist. Enumerating them here is what catches a
// renamed or dropped key, and it is how the cloudNodes.* namespace collision
// with /cloud/supported-nodes would have surfaced.
const dynamicKeys: string[] = [
  ...[1, 2, 3].flatMap((n) => [
    `cloudNodesLaunch.setup.step${n}.label`,
    `cloudNodesLaunch.setup.step${n}.description`
  ]),
  ...[1, 2, 3].map((n) => `cloudNodesLaunch.hero.feature${n}`),
  ...[1, 2, 3, 4].map((n) => `cloudNodesLaunch.howItWorks.${n}.label`),
  ...[1, 2, 3, 4].flatMap((n) => [
    `cloudNodesLaunch.why.${n}.title`,
    `cloudNodesLaunch.why.${n}.description`
  ]),
  ...[1, 2, 3, 4, 5, 6, 7].flatMap((n) => [
    `cloudNodesLaunch.faq.${n}.q`,
    `cloudNodesLaunch.faq.${n}.a`
  ])
]

const staticKeys: string[] = [
  'cloudNodesLaunch.meta.title',
  'cloudNodesLaunch.meta.description',
  'cloudNodesLaunch.hero.title',
  'cloudNodesLaunch.hero.titleHighlight',
  'cloudNodesLaunch.hero.subtitle',
  'cloudNodesLaunch.hero.videoAlt',
  'cloudNodesLaunch.setup.heading',
  'cloudNodesLaunch.models.heading',
  'cloudNodesLaunch.models.subtitle',
  'cloudNodesLaunch.models.footnote',
  'cloudNodesLaunch.models.footnoteLink',
  'cloudNodesLaunch.howItWorks.heading',
  'cloudNodesLaunch.howItWorks.subheading',
  'cloudNodesLaunch.why.heading',
  'cloudNodesLaunch.why.headingHighlight',
  'cloudNodesLaunch.why.subtitle',
  'cloudNodesLaunch.faq.heading',
  'cloudNodesLaunch.closing.heading',
  'cloudNodesLaunch.closing.subtitle',
  'breadcrumb.cloudNodes'
]

const allKeys = [...staticKeys, ...dynamicKeys]

describe('cloud-nodes copy', () => {
  it('defines every key the page renders', () => {
    const missing = allKeys.filter((key) => !hasKey(key))
    expect(missing).toEqual([])
  })

  it.each(locales)('has non-empty copy in %s', (locale) => {
    for (const key of allKeys) {
      expect(t(key as TranslationKey, locale).trim()).not.toBe('')
    }
  })
})
