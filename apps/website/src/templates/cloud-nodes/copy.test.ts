import { describe, expect, it } from 'vitest'

import type { Locale, TranslationKey } from '../../i18n/translations'

import { t, te } from '../../i18n/translations'

const locales: Locale[] = ['en', 'zh-CN']

const dynamicKeys: string[] = [
  ...[1, 2, 3, 4].flatMap((n) => [
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

const staticKeys: TranslationKey[] = [
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

const pluralKey: TranslationKey = 'cloudNodesLaunch.models.nodeCount'

const allKeys: string[] = [...staticKeys, ...dynamicKeys]

describe('cloud-nodes copy', () => {
  it('defines every key the page renders', () => {
    const missing = [...allKeys, pluralKey].filter((key) => !te(key, 'en'))
    expect(missing).toEqual([])
  })

  it.for(locales)('has non-empty copy in %s', (locale) => {
    const empty = allKeys.filter(
      (key) => t(key as TranslationKey, {}, { locale: locale }).trim() === ''
    )
    expect(empty).toEqual([])
  })

  it.for(locales)('has non-empty plural copy in %s', (locale) => {
    expect(t(pluralKey, { count: 2 }, { locale, plural: 2 }).trim()).not.toBe(
      ''
    )
  })
})
