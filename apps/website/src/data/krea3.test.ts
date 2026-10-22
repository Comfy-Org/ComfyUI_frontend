import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { isExcludedFromSitemap, isNoindexPathname } from '@/config/indexing'
import { translationsFor } from '@/i18n/translations'
import ModelLaunchGallerySection from '@/templates/model-launch/ModelLaunchGallerySection.vue'
import { krea3Links, krea3Page } from './krea3'

const locales = ['en', 'zh-CN'] as const
const APPROVED_SPEED_QUESTION = 'How fast is Krea 3 when editing images?'

describe('Krea 3 launch draft', () => {
  it('shows the Premium badge on every linked workflow example', () => {
    render(ModelLaunchGallerySection, {
      props: { gallery: krea3Page.workflowGallery, locale: 'en' }
    })
    expect(screen.getAllByText(/^premium$/i)).toHaveLength(2)
    expect(screen.getAllByText('Pay-as-you-go')).toHaveLength(2)
    expect(screen.queryAllByRole('slider')).toHaveLength(0)
    expect(
      screen.getByRole('link', { name: 'Krea 3: Image editing' })
    ).toHaveAttribute('href', krea3Links.imageEdit)
  })

  it('opens image editing from the main calls to action', () => {
    expect(krea3Page.hero.primaryCta.href).toBe(
      'https://cloud.comfy.org/?template=api_krea3_image_edit'
    )
    expect(krea3Page.closingCta.primaryCta.href).toBe(krea3Links.imageEdit)
  })

  it('offers each supplied Krea workflow', () => {
    expect(
      krea3Page.workflowGallery.cards.map(({ href }) =>
        new URL(href).searchParams.get('template')
      )
    ).toEqual(['api_krea3_image_edit', 'api_krea3_t2i'])
  })

  it.for(locales)('lists the %s page in search indexes', (locale) => {
    const prefix = locale === 'en' ? '' : `/${locale}`
    const path = `${prefix}/krea-3/`
    expect(isNoindexPathname(path)).toBe(false)
    expect(isExcludedFromSitemap(`https://comfy.org${path}`)).toBe(false)
  })

  it.for(locales)(
    'provides translated copy without unapproved claims in %s',
    (locale) => {
      const { t, te } = translationsFor(locale)
      const keys = [
        krea3Page.hero.titleKey,
        krea3Page.workflowGallery.headingKey,
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
          item.question[locale].replace(APPROVED_SPEED_QUESTION, ''),
          item.answer[locale]
        ])
      ].join(' ')
      expect(copy).not.toMatch(
        /nano banana|5\s*[×x]|quarter of the cost|\bfast(?:er)?\b|\bcheap\b|\blive (?:now|today)\b|更快|低价|便宜/i
      )
    }
  )

  it('plays the updated launch video in the hero', () => {
    expect(krea3Page.hero.videoSrc).toBe(
      'https://media.comfy.org/website/krea-3/krea3-16x9-jp-20261015-d009ff37.mp4'
    )
  })

  it('keeps the approved FAQ copy and bullet format', () => {
    const { items } = krea3Page.faq
    expect(items.map((item) => item.question.en)).toEqual([
      'What is Krea 3, and how does it differ from traditional AI image tools?',
      'How fast is Krea 3 when editing images?',
      'How does regional precision and exact color matching work in Krea 3?',
      'Can Krea 3 maintain character consistency across different scenes?',
      'How many reference images can I combine, and what is the output resolution?',
      'What creative industries and workflows is Krea 3 built for?'
    ])
    expect(items.map((item) => item.answer.en).join('\n')).not.toContain(
      '\u2014'
    )
    expect(
      items[2].answer.en.split('\n').filter((l) => l.startsWith('• '))
    ).toHaveLength(2)
    expect(
      items[5].answer.en.split('\n').filter((l) => l.startsWith('• '))
    ).toHaveLength(3)
  })

  it('serves every poster and gallery asset from the media CDN', () => {
    const sources = [
      ...krea3Page.workflowGallery.cards.flatMap((card) => [
        card.media.src,
        ...(card.comparison
          ? [card.comparison.beforeSrc, card.comparison.afterSrc]
          : [])
      ]),
      krea3Page.comparison.beforeSrc,
      krea3Page.comparison.afterSrc,
      krea3Page.hero.posterSrc,
      ...krea3Page.galleries.flatMap((gallery) =>
        gallery.cards.map((card) => card.media.src)
      )
    ]
    for (const src of sources) {
      expect(src).toMatch(/^https:\/\/media\.comfy\.org\/website\/krea-3\//)
    }
  })
})
