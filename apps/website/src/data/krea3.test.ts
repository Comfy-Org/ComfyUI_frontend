import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { websiteRoot } from '@website/paths'
import { isExcludedFromSitemap, isNoindexPathname } from '@/config/indexing'
import { translationsFor } from '@/i18n/translations'
import { krea3Page } from './krea3'

const locales = ['en', 'zh-CN'] as const

describe('Krea 3 launch draft', () => {
  it.for(locales)('keeps the %s draft out of search indexes', (locale) => {
    const prefix = locale === 'en' ? '' : `/${locale}`
    const path = `${prefix}/krea-3/`
    expect(isNoindexPathname(path)).toBe(true)
    expect(isExcludedFromSitemap(`https://comfy.org${path}`)).toBe(true)
  })

  it.for(locales)(
    'provides translated copy without unapproved claims in %s',
    (locale) => {
      const { t, te } = translationsFor(locale)
      const keys = [
        krea3Page.hero.titleKey,
        krea3Page.comparison.headingKey,
        krea3Page.hero.descriptionKey,
        ...krea3Page.galleries.map((gallery) => gallery.headingKey),
        krea3Page.steps.headingKey,
        krea3Page.faq.headingKey,
        krea3Page.closingCta.headingKey
      ]
      expect(keys.every((key) => te(key, locale))).toBe(true)
      const copy = [
        ...keys.map((key) => t(key)),
        ...krea3Page.galleries.flatMap((gallery) =>
          gallery.cards.flatMap((card) => [
            card.name[locale],
            card.description[locale]
          ])
        ),
        ...krea3Page.faq.items.flatMap((item) => [
          item.question[locale],
          item.answer[locale]
        ])
      ].join(' ')
      expect(copy).not.toMatch(
        /nano banana|5\s*[×x]|quarter of the cost|\bfast(?:er)?\b|\bcheap\b|\blive (?:now|today)\b|更快|低价|便宜/i
      )
    }
  )

  it('ships every hero and gallery asset locally for private review', () => {
    const sources = [
      krea3Page.comparison.beforeSrc,
      krea3Page.comparison.afterSrc,
      krea3Page.hero.videoSrc,
      krea3Page.hero.posterSrc,
      ...krea3Page.galleries.flatMap((gallery) =>
        gallery.cards.map((card) => card.media.src)
      )
    ]
    for (const src of sources) {
      expect(src).toMatch(/^\/media\/krea-3\//)
      expect(existsSync(join(websiteRoot, 'public', src))).toBe(true)
    }
  })
})
